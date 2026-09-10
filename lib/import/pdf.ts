import { getDocumentProxy } from 'unpdf';
import { parseMinor } from '../domain/money.ts';
import { normalizeAmountSign } from './direction.ts';
import { currencies } from '../domain/types.ts';
import { validDate } from '../domain/validation.ts';
import { findService } from '../domain/catalog.ts';
import {
  blockBounds,
  groupItemsIntoLines,
  type PdfTextItem,
  type TransactionBlock,
  type VisualLine,
} from './pdf/layout.ts';
import {
  genericBankProfile,
  selectBankProfile,
  type BankStatementProfile,
} from './pdf/profiles.ts';
export type ParseReviewReason =
  | 'multiple_amount_candidates'
  | 'merchant_missing'
  | 'merchant_looks_like_category'
  | 'balance_may_be_amount'
  | 'ambiguous_direction'
  | 'date_uncertain'
  | 'unknown_layout'
  | 'multiple_merchant_candidates';
export type PdfRow = {
  id: string;
  date: string;
  time?: string;
  merchant: string;
  bankCategory?: string;
  amount: string;
  currency: string;
  direction: 'expense' | 'income' | 'unknown';
  dateConfidence?: number;
  merchantConfidence?: number;
  amountConfidence?: number;
  directionConfidence?: number;
  parseConfidence?: number;
  reviewReasons?: ParseReviewReason[];
  selected: boolean;
};
export type PdfPreview = {
  rows: PdfRow[];
  totalPages: number;
  skippedRows: number;
  emptyPages: number;
  warnings: string[];
};
export type PdfCell = PdfTextItem;
const datePattern = /\b(\d{2}[./]\d{2}[./](?:\d{2}|\d{4})|\d{4}-\d{2}-\d{2})\b/;
const timePattern = /\b([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/;
const moneyPattern =
  /(?<![\d.,])([+−–—﹣－＋-]?\s*(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{2}|(?=\s*(?:₽|€|\$|RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY))))(?![\d.,])/gi;
const normalizedLabel = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.:]+$/g, '')
    .trim();
const isCategory = (
  text: string,
  profile: BankStatementProfile = genericBankProfile,
) => profile.knownCategoryLabels.includes(normalizedLabel(text));
const hasLabel = (text: string, labels: string[]) => {
  const normalized = normalizedLabel(text);
  return labels.some((label) =>
    new RegExp(
      `(?:^|\\b)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|:)`,
      'i',
    ).test(normalized),
  );
};

function semanticText(text: string) {
  return text
    .normalize('NFKC')
    .replace(datePattern, ' ')
    .replace(timePattern, ' ')
    .replace(moneyPattern, ' ')
    .replace(/\b(?:RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b|₽|€|\$/gi, ' ')
    .replace(/^\s*\d{5,}\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanMerchantText(text: string): string {
  return semanticText(text)
    .replace(
      /(?:[.,]\s*)?(?:операция\s+по\s+карте|карта|card)\s+\*{2,}\d{2,}.*$/i,
      '',
    )
    .replace(
      /(?:[.,]\s*)?(?:оплата\s+товаров\s+и\s+услуг|оплата\s+покупки)\s*$/i,
      '',
    )
    .replace(/^(?:purchase|payment)$/i, '')
    .replace(/[.,;:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

const reviewReasonText: Record<ParseReviewReason, string> = {
  multiple_amount_candidates: 'Найдено несколько возможных сумм',
  merchant_missing: 'Не найдено описание получателя',
  merchant_looks_like_category: 'Найдена категория банка вместо получателя',
  balance_may_be_amount: 'Сумма может быть остатком на счёте',
  ambiguous_direction: 'Не определено направление операции',
  date_uncertain: 'Нужно уточнить дату',
  unknown_layout: 'Не удалось уверенно определить структуру операции',
  multiple_merchant_candidates: 'Найдено несколько возможных получателей',
};
export function pdfRowReviewReason(row: PdfRow): string | null {
  if (row.direction === 'unknown') return 'Не определено направление операции';
  if (!validDate(row.date)) return 'Нужно уточнить дату';
  if (row.merchant.trim().length < 2) return 'Не найдено описание получателя';
  if (isCategory(row.merchant.trim()))
    return 'Найдена категория банка вместо получателя';
  try {
    if (!parseMinor(row.amount)) return 'Нужно уточнить сумму';
  } catch {
    return 'Нужно уточнить сумму';
  }
  if (!currencies.includes(row.currency.toUpperCase() as never))
    return 'Нужно уточнить валюту';
  if (row.reviewReasons?.length) return reviewReasonText[row.reviewReasons[0]];
  if ((row.parseConfidence ?? 1) < 0.72)
    return reviewReasonText[row.reviewReasons?.[0] ?? 'unknown_layout'];
  return null;
}
function isoDate(s: string) {
  if (s.includes('-')) return s;
  const [d, m, y] = s.split(/[./]/);
  const fullYear = y.length === 2 ? (Number(y) >= 70 ? '19' : '20') + y : y;
  return fullYear + '-' + m + '-' + d;
}

type PdfColumns = {
  debitX?: number;
  creditX?: number;
  amountX?: number;
  balanceX?: number;
  categoryX?: number;
  merchantX?: number;
};

export type AmountCandidate = {
  valueMinor: number;
  currency?: string;
  x: number;
  y: number;
  rawText: string;
  score: number;
  reasons: string[];
  direction: PdfRow['direction'];
  directionConfidence: number;
};

export type MerchantCandidate = {
  text: string;
  x: number;
  y: number;
  score: number;
  reasons: string[];
};

const excludedLine = (text: string) =>
  /^(?:итого|всего|остаток|страница|page|дата формирования|оборот|выписка|номер счета|номер счёта)/i.test(
    text.trim(),
  );

function detectColumns(lines: VisualLine[], profile: BankStatementProfile) {
  const columns: PdfColumns = {};
  for (const line of lines) {
    if (datePattern.test(line.text) || moneyPattern.test(line.text)) {
      moneyPattern.lastIndex = 0;
      continue;
    }
    moneyPattern.lastIndex = 0;
    for (const cell of line.cells) {
      const text = normalizedLabel(cell.text);
      if (/расход|списан|дебет|debit/.test(text)) columns.debitX = cell.x;
      if (/приход|пополн|зачислен|кредит|credit/.test(text))
        columns.creditX = cell.x;
      if (/остаток|баланс|balance/.test(text)) columns.balanceX = cell.x;
      if (/^категори[яи]|^тип операции|^category/.test(text))
        columns.categoryX = cell.x;
      if (profile.merchantColumnHints.some((hint) => text.includes(hint)))
        columns.merchantX = cell.x;
      if (profile.amountColumnHints.some((hint) => text.includes(hint)))
        columns.amountX = cell.x;
    }
  }
  return columns;
}

function lineHasConcreteMerchant(
  line: VisualLine,
  profile: BankStatementProfile,
) {
  return line.cells.some((cell) => {
    const cleaned = cleanMerchantText(cell.text);
    return (
      cleaned.length >= 2 &&
      !isCategory(cleaned, profile) &&
      !hasLabel(line.text, profile.balanceLabels) &&
      !/^\d+$/.test(cleaned)
    );
  });
}

export function buildTransactionBlocks(
  lines: VisualLine[],
  profile: BankStatementProfile = genericBankProfile,
): TransactionBlock[] {
  const blocks: TransactionBlock[] = [];
  let current: VisualLine[] = [];
  const flush = () => {
    if (current.length)
      blocks.push({ lines: current, boundingBox: blockBounds(current) });
    current = [];
  };
  for (const line of lines) {
    if (excludedLine(line.text)) {
      flush();
      continue;
    }
    const date = line.text.match(datePattern)?.[0];
    const dateCell = line.cells.find((cell) => datePattern.test(cell.text));
    const dated = !!date && !!dateCell && dateCell.x < 250;
    if (dated) {
      const previousDate = current[0]?.text.match(datePattern)?.[0];
      const gap = current.length
        ? current[current.length - 1].y - line.y
        : Infinity;
      const continuation =
        !!previousDate &&
        isoDate(previousDate) === isoDate(date!) &&
        gap > 0 &&
        gap <= 22 &&
        !current.some((candidate) =>
          lineHasConcreteMerchant(candidate, profile),
        ) &&
        lineHasConcreteMerchant(line, profile);
      if (!continuation) flush();
      current.push(line);
      continue;
    }
    if (!current.length) continue;
    const gap = current[current.length - 1].y - line.y;
    if (gap > 0 && gap <= 34) current.push(line);
    else flush();
  }
  flush();
  return blocks;
}

function directionForCandidate(
  raw: string,
  line: VisualLine,
  x: number,
  columns: PdfColumns,
) {
  const normalized = normalizeAmountSign(raw).replace(/\s/g, '');
  if (normalized.startsWith('+'))
    return {
      direction: 'income' as const,
      confidence: 0.99,
      reason: 'explicit_plus',
    };
  if (normalized.startsWith('-'))
    return {
      direction: 'expense' as const,
      confidence: 0.99,
      reason: 'explicit_minus',
    };
  const debitDistance =
    columns.debitX === undefined ? Infinity : Math.abs(x - columns.debitX);
  const creditDistance =
    columns.creditX === undefined ? Infinity : Math.abs(x - columns.creditX);
  if (Math.min(debitDistance, creditDistance) < 70) {
    const direction: 'income' | 'expense' =
      creditDistance < debitDistance ? 'income' : 'expense';
    return { direction, confidence: 0.94, reason: direction + '_column' };
  }
  const text = normalizedLabel(line.text);
  if (/пополн|зачислен|возврат|доход|credit|refund/.test(text))
    return {
      direction: 'income' as const,
      confidence: 0.88,
      reason: 'income_type',
    };
  if (/покуп|оплат|списан|расход|debit/.test(text))
    return {
      direction: 'expense' as const,
      confidence: 0.88,
      reason: 'expense_type',
    };
  return {
    direction: 'expense' as const,
    confidence: 0.72,
    reason: 'unsigned_fallback',
  };
}

export function scoreAmountCandidates(
  block: TransactionBlock,
  columns: PdfColumns,
  profile: BankStatementProfile = genericBankProfile,
): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  for (const line of block.lines) {
    const balanceLike = hasLabel(line.text, profile.balanceLabels);
    const summaryLike = /(?:итого|оборот|остаток на (?:начало|конец))/i.test(
      line.text,
    );
    const concreteMerchant = lineHasConcreteMerchant(line, profile);
    for (const cell of line.cells) {
      if (datePattern.test(cell.text) && !moneyPattern.test(cell.text))
        continue;
      moneyPattern.lastIndex = 0;
      for (const match of cell.text.matchAll(moneyPattern)) {
        const normalized = normalizeAmountSign(match[1])
          .replace(/\s/g, '')
          .replace(',', '.');
        let minor: number;
        try {
          minor = parseMinor(normalized);
        } catch {
          continue;
        }
        if (!minor) continue;
        const x =
          cell.x +
          ((match.index ?? 0) / Math.max(cell.text.length, 1)) * cell.width;
        const reasons: string[] = [];
        let score = 0;
        const near = (value: number | undefined, distance: number) =>
          value !== undefined && Math.abs(x - value) < distance;
        if (near(columns.balanceX, 55)) {
          score -= 45;
          reasons.push('balance_column');
        }
        if (balanceLike) {
          score -= 50;
          reasons.push('balance_label');
        }
        if (summaryLike) {
          score -= 35;
          reasons.push('summary_label');
        }
        if (near(columns.amountX, 75)) {
          score += 12;
          reasons.push('amount_column');
        }
        if (near(columns.debitX, 70) || near(columns.creditX, 70)) {
          score += 16;
          reasons.push('debit_or_credit_column');
        }
        if (
          /[₽$€]|\b(?:RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b/i.test(cell.text)
        ) {
          score += 3;
          reasons.push('explicit_currency');
        }
        if (/^[+−–—﹣－＋-]/.test(match[1].trim())) {
          score += 5;
          reasons.push('explicit_sign');
        }
        if (concreteMerchant) {
          score += 5;
          reasons.push('same_line_as_merchant');
        }
        if (datePattern.test(line.text)) {
          score += 4;
          reasons.push('same_line_as_date');
        }
        if (timePattern.test(line.text)) {
          score += 3;
          reasons.push('same_line_as_time');
        }
        if (
          line.cells.some((candidate) =>
            isCategory(semanticText(candidate.text), profile),
          )
        ) {
          score += 3;
          reasons.push('transaction_category_line');
        }
        if (x >= line.maxX - Math.max(80, cell.width + 5)) {
          score += 2;
          reasons.push('right_side');
        }
        const direction = directionForCandidate(match[1], line, x, columns);
        candidates.push({
          valueMinor: Math.abs(minor),
          currency: cell.text.match(
            /\b(RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b/i,
          )?.[1],
          x,
          y: line.y,
          rawText: match[1],
          score,
          reasons: [...reasons, direction.reason],
          direction: direction.direction,
          directionConfidence: direction.confidence,
        });
      }
      moneyPattern.lastIndex = 0;
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.x - b.x);
}

export function scoreMerchantCandidates(
  block: TransactionBlock,
  amount: AmountCandidate,
  columns: PdfColumns,
  profile: BankStatementProfile = genericBankProfile,
): MerchantCandidate[] {
  const candidates: MerchantCandidate[] = [];
  for (const line of block.lines) {
    if (hasLabel(line.text, profile.balanceLabels)) continue;
    for (const cell of line.cells) {
      const text = cleanMerchantText(cell.text);
      if (!text || /^\d+$/.test(text) || isCategory(text, profile)) continue;
      if (/^(?:операция|детали|описание|получатель|merchant)$/i.test(text))
        continue;
      const reasons: string[] = [];
      let score = Math.min(6, text.length / 8);
      if (
        columns.merchantX !== undefined &&
        Math.abs(cell.x - columns.merchantX) < 90
      ) {
        score += 10;
        reasons.push('merchant_column');
      }
      if (Math.abs(line.y - amount.y) < 3) {
        score += 5;
        reasons.push('same_line_as_amount');
      }
      if (findService(text)) {
        score += 12;
        reasons.push('service_catalog_alias');
      }
      if (/[*.]|\b(?:RU|RUS|MOSCOW|ООО|ИП)\b/i.test(text)) {
        score += 3;
        reasons.push('merchant_like_text');
      }
      candidates.push({ text, x: cell.x, y: line.y, score, reasons });
    }
  }
  const unique = new Map<string, MerchantCandidate>();
  for (const candidate of candidates) {
    const previous = unique.get(candidate.text.toUpperCase());
    if (!previous || candidate.score > previous.score)
      unique.set(candidate.text.toUpperCase(), candidate);
  }
  const deduplicated = [...unique.values()];
  const merchantReferenceX = columns.merchantX ?? deduplicated[0]?.x;
  const aligned = deduplicated
    .filter(
      (candidate) =>
        merchantReferenceX !== undefined &&
        Math.abs(candidate.x - merchantReferenceX) < 90,
    )
    .sort((a, b) => b.y - a.y);
  if (aligned.length > 1) {
    const text = cleanMerchantText(
      aligned.map((candidate) => candidate.text).join(' '),
    );
    if (text.length <= 240)
      deduplicated.push({
        text,
        x: aligned[0].x,
        y: aligned[0].y,
        score: Math.max(...aligned.map((candidate) => candidate.score)) + 2,
        reasons: ['multi_line_merchant'],
      });
  }
  return deduplicated.sort((a, b) => b.score - a.score);
}

export function parsePdfPage(
  cells: PdfCell[],
  currency = 'RUB',
  page = 1,
): { rows: PdfRow[]; skipped: number } {
  const lines = groupItemsIntoLines(cells);
  const profile = selectBankProfile(lines.map((line) => line.text).join('\n'));
  const columns = detectColumns(lines, profile);
  const blocks = buildTransactionBlocks(lines, profile);
  const result: PdfRow[] = [];
  let skipped = 0;
  for (const block of blocks) {
    const amountCandidates = scoreAmountCandidates(block, columns, profile);
    const chosen = amountCandidates[0];
    if (!chosen || chosen.score < 0) {
      skipped++;
      continue;
    }
    const merchantCandidates = scoreMerchantCandidates(
      block,
      chosen,
      columns,
      profile,
    );
    const merchant = merchantCandidates[0]?.text ?? '';
    const blockText = block.lines.map((line) => line.text).join(' ');
    const matchedCurrency = blockText.match(
      /\b(RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b/,
    )?.[1];
    const curr =
      matchedCurrency === 'RUR'
        ? 'RUB'
        : (matchedCurrency ?? (blockText.includes('₽') ? 'RUB' : currency));
    const rawDate = blockText.match(datePattern)?.[0] ?? '';
    const date = isoDate(rawDate);
    const category = block.lines
      .flatMap((line) => line.cells)
      .map((cell) => semanticText(cell.text))
      .find((text) => isCategory(text, profile));
    const amountConfidence =
      chosen.score >= 14 ? 0.97 : chosen.score >= 8 ? 0.88 : 0.68;
    const merchantConfidence =
      (merchantCandidates[0]?.score ?? 0) >= 12
        ? 0.94
        : (merchantCandidates[0]?.score ?? 0) >= 5
          ? 0.82
          : merchant
            ? 0.68
            : 0.2;
    const reasons: ParseReviewReason[] = [];
    const nextAmount = amountCandidates[1];
    if (nextAmount && Math.abs(chosen.score - nextAmount.score) <= 3)
      reasons.push('multiple_amount_candidates');
    if (chosen.reasons.some((reason) => reason.startsWith('balance')))
      reasons.push('balance_may_be_amount');
    if (!merchant) reasons.push('merchant_missing');
    if (isCategory(merchant, profile))
      reasons.push('merchant_looks_like_category');
    if (
      merchantCandidates[1] &&
      !merchantCandidates[0].reasons.includes('multi_line_merchant') &&
      Math.abs(merchantCandidates[0].score - merchantCandidates[1].score) <= 2
    )
      reasons.push('multiple_merchant_candidates');
    if (chosen.directionConfidence < 0.7) reasons.push('ambiguous_direction');
    if (!validDate(date)) reasons.push('date_uncertain');
    const parseConfidence = Math.min(
      0.99,
      amountConfidence,
      merchantConfidence,
      chosen.directionConfidence,
    );
    if (parseConfidence < 0.72 && !reasons.length)
      reasons.push('unknown_layout');
    const row: PdfRow = {
      id: 'p' + page + '-' + result.length,
      date,
      time: blockText.match(timePattern)?.[0],
      merchant,
      bankCategory: category,
      amount: String(chosen.valueMinor / 100),
      currency: curr,
      direction: chosen.direction,
      dateConfidence: validDate(date) ? 0.99 : 0.2,
      merchantConfidence,
      amountConfidence,
      directionConfidence: chosen.directionConfidence,
      parseConfidence,
      reviewReasons: reasons,
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
          height: (item as { height?: number }).height,
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
    [
      'date',
      'time',
      'merchant',
      'bankCategory',
      'amount',
      'currency',
      'direction',
      'parseConfidence',
      'parseReviewReasons',
    ],
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
        return [
          r.date,
          typeof r.time === 'string' ? r.time : '',
          r.merchant,
          typeof r.bankCategory === 'string' ? r.bankCategory : '',
          r.amount,
          r.currency,
          r.direction,
          typeof r.parseConfidence === 'number'
            ? String(r.parseConfidence)
            : '',
          Array.isArray(r.reviewReasons) ? r.reviewReasons.join(',') : '',
        ];
      }),
  ];
}
