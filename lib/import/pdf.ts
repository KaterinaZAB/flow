import { getDocumentProxy } from 'unpdf';
import { parseMinor } from '../domain/money.ts';
import { amountDirection, normalizeAmountSign } from './direction.ts';
import { currencies } from '../domain/types.ts';
import { validDate } from '../domain/validation.ts';
export type PdfRow = {
  id: string;
  date: string;
  merchant: string;
  amount: string;
  currency: string;
  direction: 'expense' | 'income' | 'unknown';
  selected: boolean;
};
export type PdfPreview = {
  rows: PdfRow[];
  totalPages: number;
  skippedRows: number;
  emptyPages: number;
  warnings: string[];
};
export type PdfCell = { text: string; x: number; y: number; width: number };
const datePattern = /\b(\d{2}[./]\d{2}[./]\d{4}|\d{4}-\d{2}-\d{2})\b/;
const moneyPattern =
  /(?<![\d.,])([+−–—﹣－＋-]?\s*(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)[.,]\d{2})(?![\d.,])/g;
const bankCategoryOnly =
  /^(?:транспорт|путешествия|рестораны|кафе|супермаркеты|продукты|развлечения|здоровье|красота|одежда|прочее|переводы|transport|travel|restaurants?|groceries|entertainment|other)$/i;
export function pdfRowReviewReason(row: PdfRow): string | null {
  if (row.direction === 'unknown') return 'Не определено направление операции';
  if (!validDate(row.date)) return 'Нужно уточнить дату';
  if (row.merchant.trim().length < 2) return 'Не найдено описание получателя';
  if (bankCategoryOnly.test(row.merchant.trim()))
    return 'Найдена категория банка вместо получателя';
  try {
    if (!parseMinor(row.amount)) return 'Нужно уточнить сумму';
  } catch {
    return 'Нужно уточнить сумму';
  }
  if (!currencies.includes(row.currency.toUpperCase() as never))
    return 'Нужно уточнить валюту';
  return null;
}
function linesFromCells(cells: PdfCell[]) {
  const groups: { y: number; cells: PdfCell[] }[] = [];
  for (const cell of cells
    .filter((c) => c.text.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = groups.find((g) => Math.abs(g.y - cell.y) < 2.5);
    if (!row) {
      row = { y: cell.y, cells: [] };
      groups.push(row);
    }
    row.cells.push(cell);
  }
  return groups.map((row) => {
    const sorted = row.cells.sort((a, b) => a.x - b.x);
    const merged: PdfCell[] = [];
    for (const c of sorted) {
      const last = merged[merged.length - 1];
      if (last && c.x - (last.x + last.width) < 9 && c.x >= last.x) {
        last.text += ' ' + c.text;
        last.width = c.x + c.width - last.x;
      } else merged.push({ ...c });
    }
    return { cells: merged, text: merged.map((c) => c.text).join('  ') };
  });
}
function isoDate(s: string) {
  if (s.includes('-')) return s;
  const [d, m, y] = s.split(/[./]/);
  return y + '-' + m + '-' + d;
}
export function parsePdfPage(
  cells: PdfCell[],
  currency = 'RUB',
  page = 1,
): { rows: PdfRow[]; skipped: number } {
  const lines = linesFromCells(cells);
  let debitX: number | undefined,
    creditX: number | undefined,
    amountX: number | undefined,
    balanceX: number | undefined,
    categoryX: number | undefined,
    merchantX: number | undefined;
  for (const line of lines) {
    if (datePattern.test(line.text) || moneyPattern.test(line.text)) {
      moneyPattern.lastIndex = 0;
      continue;
    }
    moneyPattern.lastIndex = 0;
    for (const c of line.cells) {
      const t = c.text.toLowerCase();
      if (/расход|списан|дебет|debit/.test(t)) debitX = c.x;
      if (/приход|зачислен|кредит|credit/.test(t)) creditX = c.x;
      if (/остаток|баланс|balance/.test(t)) balanceX = c.x;
      if (/^категори[яи]|^category/.test(t)) categoryX = c.x;
      if (/описание|назначение|получатель|description|merchant/.test(t))
        merchantX = c.x;
      if (/сумма.*(?:счет|счёт|руб)|amount|сумма операции/.test(t))
        amountX = c.x;
    }
  }
  const blocks: { date: string; cells: PdfCell[]; text: string }[] = [];
  let current: (typeof blocks)[number] | null = null;
  for (const line of lines) {
    const date = line.text.match(datePattern)?.[0];
    const dateCell = line.cells.find((c) => datePattern.test(c.text));
    const dated = !!date && !!dateCell && dateCell.x < 250;
    if (dated) {
      if (current) blocks.push(current);
      current = {
        date: isoDate(date!),
        cells: [...line.cells],
        text: line.text,
      };
    } else if (
      current &&
      !/^(?:итого|всего|остаток|страница|page|дата формирования|оборот|выписка|номер счета|номер счёта)/i.test(
        line.text.trim(),
      )
    ) {
      current.cells.push(...line.cells);
      current.text += ' ' + line.text;
    }
  }
  if (current) blocks.push(current);
  const result: PdfRow[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const choices: {
      amount: string;
      x: number;
      score: number;
      direction: PdfRow['direction'];
    }[] = [];
    for (const c of block.cells) {
      if (datePattern.test(c.text) && !c.text.includes(' ')) continue;
      for (const m of c.text.matchAll(moneyPattern)) {
        const raw = normalizeAmountSign(m[1])
          .replace(/\s/g, '')
          .replace(',', '.');
        let minor: number;
        try {
          minor = parseMinor(raw);
        } catch {
          continue;
        }
        if (!minor) continue;
        const x = c.x + ((m.index ?? 0) / Math.max(c.text.length, 1)) * c.width;
        let score = 0;
        const debitDistance =
          debitX === undefined ? Infinity : Math.abs(x - debitX);
        const creditDistance =
          creditX === undefined ? Infinity : Math.abs(x - creditX);
        const columnDirection =
          creditDistance < 70 && creditDistance < debitDistance
            ? 'income'
            : 'expense';
        const direction: PdfRow['direction'] = amountDirection(
          raw,
          columnDirection,
        );
        if (balanceX !== undefined && Math.abs(x - balanceX) < 50) score -= 20;
        if (amountX !== undefined)
          score += Math.max(0, 10 - Math.abs(x - amountX) / 10);
        if (Math.min(debitDistance, creditDistance) < 70) score += 12;
        if (/[₽$€]|RUB|RUR|USD|EUR/.test(c.text)) score += 2;
        if (/^[+-]/.test(raw)) score += 3;
        choices.push({
          amount: String(Math.abs(minor) / 100),
          x,
          score,
          direction,
        });
      }
    }
    if (!choices.length) {
      skipped++;
      continue;
    }
    choices.sort((a, b) => b.score - a.score || a.x - b.x);
    const chosen = choices[0];
    if (chosen.score < 0) {
      skipped++;
      continue;
    }
    let merchant = block.cells
      .filter((c) => {
        if (
          merchantX !== undefined &&
          c.x >= merchantX - 8 &&
          c.x < merchantX + 170
        )
          return true;
        if (merchantX !== undefined) return false;
        return (
          !datePattern.test(c.text) &&
          (categoryX === undefined || Math.abs(c.x - categoryX) >= 70) &&
          !/^[-−+\d\s.,:₽$€]+$/.test(c.text.trim()) &&
          !/^(RUB|RUR|USD|EUR|₽)$/i.test(c.text.trim())
        );
      })
      .map((c) =>
        c.text
          .replace(datePattern, '')
          .replace(moneyPattern, '')
          .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ''),
      )
      .join(' ')
      .replace(/(?:RUB|RUR|USD|EUR|₽)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    merchant = merchant
      .replace(
        /^(?:Оплата товаров и услуг|Оплата покупки|Покупка|Операция оплаты|Оплата|Payment|Purchase)[.: ]*/i,
        '',
      )
      .slice(0, 240);
    if (
      merchant.length < 2 ||
      /^(?:Итого|Остаток|Баланс|Входящий остаток|Исходящий остаток)/i.test(
        merchant,
      )
    ) {
      skipped++;
      continue;
    }
    const matchedCurrency = block.text.match(
      /\b(RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b/,
    )?.[1];
    const curr =
      matchedCurrency === 'RUR'
        ? 'RUB'
        : (matchedCurrency ?? (block.text.includes('₽') ? 'RUB' : currency));
    const row: PdfRow = {
      id: 'p' + page + '-' + result.length,
      date: block.date,
      merchant,
      amount: chosen.amount,
      currency: curr,
      direction: chosen.direction,
      selected: false,
    };
    row.selected = row.direction === 'expense' && !pdfRowReviewReason(row);
    result.push(row);
  }
  return { rows: result, skipped };
}
export async function extractPdf(
  bytes: Uint8Array,
  currency = 'RUB',
): Promise<PdfPreview> {
  if (bytes.byteLength > 5 * 1024 * 1024)
    throw new Error('PDF должен быть не больше 5 МБ.');
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
    throw new Error('Файл не является PDF.');
  let pdf;
  try {
    pdf = await getDocumentProxy(bytes, {
      useSystemFonts: false,
      disableFontFace: true,
      useWasm: false,
      verbosity: 0,
      stopAtErrors: true,
    });
  } catch (e) {
    if ((e as Error).name === 'PasswordException')
      throw new Error('PDF защищён паролем. Загрузите копию без пароля.');
    throw new Error(
      'Не удалось прочитать PDF. Попробуйте повторно скачать выписку из банка.',
    );
  }
  try {
    if (pdf.numPages > 30)
      throw new Error('Максимум 30 страниц PDF. Разделите период выписки.');
    const rows: PdfRow[] = [];
    let textLength = 0,
      skipped = 0,
      emptyPages = 0;
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const text = await page.getTextContent();
      const items = text.items.filter(
        (
          item,
        ): item is typeof item & {
          str: string;
          transform: number[];
          width: number;
        } => 'str' in item,
      );
      let pageLength = 0;
      const cells: PdfCell[] = items.map((item) => {
        textLength += item.str.length;
        pageLength += item.str.length;
        return {
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
        };
      });
      if (textLength > 1_000_000 || items.length > 30000)
        throw new Error('В PDF слишком много данных для одного импорта.');
      if (pageLength < 30) emptyPages++;
      const parsed = parsePdfPage(cells, currency, pageNo);
      rows.push(...parsed.rows);
      skipped += parsed.skipped;
      if (rows.length > 1000)
        throw new Error(
          'В PDF больше 1 000 операций. Загрузите выписку за более короткий период.',
        );
      page.cleanup();
    }
    if (textLength < 40)
      throw new Error(
        'В PDF нет текстового слоя: вероятно, это скан. Скачайте исходную электронную выписку из банка. Распознавание изображений пока не поддерживается.',
      );
    if (!rows.length)
      throw new Error(
        'Текст прочитан, но строки операций не распознаны. Нужна выписка с датой, описанием и суммой; формат этого PDF пока не поддерживается.',
      );
    const warnings = [
      'Суммы с «+» — пополнения; с «−» и без знака — расходы. Отдельные столбцы прихода и расхода тоже учитываются. Проверьте результат: остаток на счёте не должен попадать в сумму платежа.',
    ];
    if (rows.some((r) => r.direction === 'unknown'))
      warnings.push(
        'У части строк не определено направление. Укажите расход или поступление вручную.',
      );
    if (skipped)
      warnings.push(
        'Пропущено строк с датами: ' +
          skipped +
          '. Проверьте полноту распознанных операций.',
      );
    if (emptyPages)
      warnings.push(
        'На ' +
          emptyPages +
          ' страницах почти нет текста; данные с них могли не распознаться.',
      );
    return {
      rows,
      totalPages: pdf.numPages,
      skippedRows: skipped,
      emptyPages,
      warnings,
    };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
export function pdfRowsToTable(rows: unknown): string[][] {
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000)
    throw new Error('Выберите от 1 до 1 000 операций.');
  return [
    ['date', 'merchant', 'amount', 'currency', 'direction'],
    ...rows
      .filter((r) => r?.selected === true)
      .map((r) => {
        if (
          typeof r.date !== 'string' ||
          typeof r.merchant !== 'string' ||
          typeof r.amount !== 'string' ||
          typeof r.currency !== 'string' ||
          !['expense', 'income'].includes(r.direction)
        )
          throw new Error(
            'Проверьте дату, сумму и направление каждой выбранной строки.',
          );
        return [r.date, r.merchant, r.amount, r.currency, r.direction];
      }),
  ];
}
