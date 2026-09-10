import { parseMinor } from '../../domain/money.ts';
import { blockBounds, type VisualLine } from './layout.ts';

export type SberColumns = {
  operationDateX: number;
  detailsX: number;
  amountX: number;
  balanceX: number;
};

export type SberTransactionBlock = {
  operationDate?: string;
  operationTime?: string;
  processedDate?: string;
  authorizationCode?: string;
  category?: string;
  descriptionLines: string[];
  amountRaw?: string;
  balanceRaw?: string;
  sourceLines: VisualLine[];
  boundingBox: ReturnType<typeof blockBounds>;
};

export type StatementReconciliation = {
  status: 'exact' | 'mismatch' | 'unavailable';
  openingBalanceMinor?: number;
  expectedIncomeMinor?: number;
  parsedIncomeMinor: number;
  incomeDifferenceMinor?: number;
  expectedExpenseMinor?: number;
  parsedExpenseMinor: number;
  expenseDifferenceMinor?: number;
  closingBalanceMinor?: number;
  balanceDifferenceMinor?: number;
};

export type SberParsedTransaction = {
  date: string;
  time?: string;
  processedAt?: string;
  authorizationCode?: string;
  merchant: string;
  rawDescription: string;
  bankCategory?: string;
  amountMinor: number;
  balanceAfterMinor?: number;
  currency: string;
  direction: 'expense' | 'income';
  parseConfidence: number;
  reviewReasons: string[];
};

export type SberParseResult = {
  transactions: SberParsedTransaction[];
  transactionBlocks: number;
  ignoredBlocks: number;
  reconciliation: StatementReconciliation;
  period?: { from: string; to: string };
};

const datePattern = /\b(\d{2}[./]\d{2}[./](?:\d{2}|\d{4})|\d{4}-\d{2}-\d{2})\b/;
const timePattern = /\b([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/;
const authPattern = /\b\d{5,6}\b/;
const moneyPattern =
  /(?<![\d.,])([+−–—﹣－＋-]?\s*(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{2}|(?=\s*(?:₽|RUB|RUR))))(?![\d.,])/gi;

const sberCategories = [
  'Транспорт',
  'Путешествия',
  'Отдых и развлечения',
  'Прочие операции',
  'Прочие расходы',
  'Рестораны и кафе',
  'Перевод СБП',
  'Перевод с карты',
  'Перевод на карту',
  'Оплата товаров и услуг',
  'Супермаркеты',
  'Пополнение',
];
function isoDate(value: string) {
  if (value.includes('-')) return value;
  const [day, month, shortYear] = value.split(/[./]/);
  const year =
    shortYear.length === 2
      ? (Number(shortYear) >= 70 ? '19' : '20') + shortYear
      : shortYear;
  return `${year}-${month}-${day}`;
}

function minor(value: string | undefined) {
  if (!value) return undefined;
  try {
    return Math.abs(
      parseMinor(
        value
          .replace(/[₽]|\b(?:RUB|RUR)\b/gi, '')
          .replace(/[−–—﹣－]/g, '-')
          .replace(/＋/g, '+')
          .replace(/\s/g, '')
          .replace(',', '.'),
      ),
    );
  } catch {
    return undefined;
  }
}

function values(line: VisualLine) {
  const result: { raw: string; x: number }[] = [];
  for (const cell of line.cells) {
    for (const match of cell.text.matchAll(moneyPattern))
      result.push({
        raw: match[1],
        x:
          cell.x +
          ((match.index ?? 0) / Math.max(1, cell.text.length)) * cell.width,
      });
  }
  return result;
}

export function canParseModernSber(lines: VisualLine[]) {
  const text = lines.map((line) => line.text.toUpperCase()).join('\n');
  const signals = [
    'ВЫПИСКА ПО СЧЁТУ ДЕБЕТОВОЙ КАРТЫ',
    'РАСШИФРОВКА ОПЕРАЦИЙ',
    'ДАТА ОПЕРАЦИИ',
    'КАТЕГОРИЯ',
    'СУММА В ВАЛЮТЕ СЧЁТА',
    'ОСТАТОК СРЕДСТВ',
  ].filter((signal) => text.includes(signal)).length;
  return signals / 6;
}

export function detectSberColumns(lines: VisualLine[]): SberColumns {
  const all = lines.flatMap((line) => line.cells);
  const find = (pattern: RegExp) =>
    all.find((cell) => pattern.test(cell.text.toUpperCase()))?.x;
  const amountX = find(/СУММА(?: В ВАЛЮТЕ СЧ[ЕЁ]ТА)?/) ?? 390;
  const balanceX = find(/ОСТАТОК СРЕДСТВ|БАЛАНС/) ?? amountX + 90;
  return {
    operationDateX: find(/ДАТА ОПЕРАЦИИ/) ?? 35,
    detailsX: find(/КАТЕГОРИЯ|ОПИСАНИЕ/) ?? 145,
    amountX,
    balanceX,
  };
}

function primaryLine(line: VisualLine, columns: SberColumns) {
  const date = line.text.match(datePattern)?.[0];
  const time = line.text.match(timePattern)?.[0];
  return (
    !!date &&
    !!time &&
    values(line).some((value) => Math.abs(value.x - columns.amountX) < 70)
  );
}

function noise(line: VisualLine) {
  return /(?:ПРОДОЛЖЕНИЕ НА СЛЕДУЮЩЕЙ СТРАНИЦЕ|ДАТА ФОРМИРОВАНИЯ ДОКУМЕНТА|ЭЛЕКТРОНН(?:ОЙ|АЯ) ПОДПИС|ПРОВЕРИТЬ ДОКУМЕНТ|СТРАНИЦА \d+|РАСШИФРОВКА ОПЕРАЦИЙ)/i.test(
    line.text,
  );
}

export function buildSberTransactionBlocks(
  pages: VisualLine[][],
): SberTransactionBlock[] {
  const blocks: SberTransactionBlock[] = [];
  for (const lines of pages) {
    const columns = detectSberColumns(lines);
    let current: VisualLine[] = [];
    const flush = () => {
      if (current.length) blocks.push(toBlock(current, columns));
      current = [];
    };
    for (const line of lines) {
      if (noise(line)) continue;
      if (primaryLine(line, columns)) {
        flush();
        current = [line];
      } else if (current.length) {
        const gap = current[current.length - 1].y - line.y;
        if (gap > 0 && gap <= 30) current.push(line);
        else flush();
      }
    }
    flush();
  }
  return blocks;
}

function toBlock(
  lines: VisualLine[],
  columns: SberColumns,
): SberTransactionBlock {
  const first = lines[0];
  const firstDate = first.text.match(datePattern)?.[0];
  const transactionValues = values(first);
  const amount = transactionValues
    .filter((value) => Math.abs(value.x - columns.amountX) < 70)
    .sort(
      (a, b) =>
        Math.abs(a.x - columns.amountX) - Math.abs(b.x - columns.amountX),
    )[0];
  const balance = transactionValues
    .filter((value) => Math.abs(value.x - columns.balanceX) < 65)
    .sort(
      (a, b) =>
        Math.abs(a.x - columns.balanceX) - Math.abs(b.x - columns.balanceX),
    )[0];
  const detailLines = lines.slice(1);
  const processingLine = detailLines.find(
    (line) => datePattern.test(line.text) && authPattern.test(line.text),
  );
  const categoryText = first.cells
    .filter(
      (cell) =>
        cell.x >= columns.detailsX - 15 && cell.x < columns.amountX - 10,
    )
    .map((cell) => cell.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const category = sberCategories.find((label) =>
    categoryText.includes(label.toUpperCase()),
  );
  const descriptionLines = detailLines
    .flatMap((line) => line.cells)
    .filter(
      (cell) =>
        cell.x >= columns.detailsX - 15 && cell.x < columns.amountX - 10,
    )
    .map((cell) => cell.text)
    .map((text) =>
      text
        .replace(datePattern, '')
        .replace(authPattern, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
  return {
    operationDate: firstDate ? isoDate(firstDate) : undefined,
    operationTime: first.text.match(timePattern)?.[0],
    processedDate: processingLine?.text.match(datePattern)?.[0]
      ? isoDate(processingLine.text.match(datePattern)![0])
      : undefined,
    authorizationCode: processingLine?.text.match(authPattern)?.[0],
    category,
    descriptionLines,
    amountRaw: amount?.raw,
    balanceRaw: balance?.raw,
    sourceLines: lines,
    boundingBox: blockBounds(lines),
  };
}

function cleanDescription(lines: string[]) {
  return lines
    .join(' ')
    .replace(/^\d{5,6}\s+/, '')
    .replace(
      /(?:[.,]\s*)?Операция по (?:карте|сч[её]ту)\s+\*{2,}\d{2,}.*$/i,
      '',
    )
    .replace(/\s+\*{2,}\d{2,}\s*$/i, '')
    .replace(/[.,;:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function parseSberBlock(
  block: SberTransactionBlock,
): SberParsedTransaction | null {
  const amountMinor = minor(block.amountRaw);
  if (!block.operationDate || !amountMinor) return null;
  const rawDescription = block.descriptionLines.join(' ').trim().slice(0, 1000);
  const merchant = cleanDescription(block.descriptionLines);
  const direction = /^[+＋]/.test(block.amountRaw?.trim() ?? '')
    ? 'income'
    : 'expense';
  const reviewReasons: string[] = [];
  if (!merchant) reviewReasons.push('merchant_missing');
  if (!block.operationTime) reviewReasons.push('date_uncertain');
  return {
    date: block.operationDate,
    time: block.operationTime,
    processedAt: block.processedDate,
    authorizationCode: block.authorizationCode,
    merchant,
    rawDescription,
    bankCategory: block.category,
    amountMinor,
    balanceAfterMinor: minor(block.balanceRaw),
    currency: 'RUB',
    direction,
    parseConfidence: reviewReasons.length ? 0.68 : 0.98,
    reviewReasons,
  };
}

function summaryValue(lines: VisualLine[], pattern: RegExp) {
  for (const line of lines) {
    if (datePattern.test(line.text) && timePattern.test(line.text)) continue;
    if (!pattern.test(line.text)) continue;
    const found = values(line);
    if (found.length) return minor(found[found.length - 1].raw);
  }
  return undefined;
}

function reconcile(
  transactions: SberParsedTransaction[],
  lines: VisualLine[],
): StatementReconciliation {
  const openingBalanceMinor = summaryValue(
    lines,
    /НАЧАЛЬН(?:ЫЙ|ОГО) ОСТАТОК|ОСТАТОК НА НАЧАЛО/i,
  );
  const expectedIncomeMinor = summaryValue(lines, /ПОПОЛНЕНИ[ЕЯ]|ЗАЧИСЛЕН/i);
  const expectedExpenseMinor = summaryValue(lines, /СПИСАНИ[ЕЯ]|РАСХОД/i);
  const closingBalanceMinor = summaryValue(
    lines,
    /КОНЕЧН(?:ЫЙ|ОГО) ОСТАТОК|ОСТАТОК НА КОНЕЦ/i,
  );
  const parsedIncomeMinor = transactions
    .filter((transaction) => transaction.direction === 'income')
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const parsedExpenseMinor = transactions
    .filter((transaction) => transaction.direction === 'expense')
    .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
  const incomeDifferenceMinor =
    expectedIncomeMinor === undefined
      ? undefined
      : parsedIncomeMinor - expectedIncomeMinor;
  const expenseDifferenceMinor =
    expectedExpenseMinor === undefined
      ? undefined
      : parsedExpenseMinor - expectedExpenseMinor;
  const balanceDifferenceMinor =
    openingBalanceMinor === undefined || closingBalanceMinor === undefined
      ? undefined
      : openingBalanceMinor +
        parsedIncomeMinor -
        parsedExpenseMinor -
        closingBalanceMinor;
  const available =
    incomeDifferenceMinor !== undefined &&
    expenseDifferenceMinor !== undefined &&
    balanceDifferenceMinor !== undefined;
  const exact =
    available &&
    Math.abs(incomeDifferenceMinor) <= 1 &&
    Math.abs(expenseDifferenceMinor) <= 1 &&
    Math.abs(balanceDifferenceMinor) <= 1;
  return {
    status: !available ? 'unavailable' : exact ? 'exact' : 'mismatch',
    openingBalanceMinor,
    expectedIncomeMinor,
    parsedIncomeMinor,
    incomeDifferenceMinor,
    expectedExpenseMinor,
    parsedExpenseMinor,
    expenseDifferenceMinor,
    closingBalanceMinor,
    balanceDifferenceMinor,
  };
}

export function parseModernSberStatement(
  pages: VisualLine[][],
): SberParseResult {
  const allLines = pages.flat();
  const blocks = buildSberTransactionBlocks(pages);
  const transactions = blocks
    .map(parseSberBlock)
    .filter(
      (transaction): transaction is SberParsedTransaction => !!transaction,
    );
  const dates = transactions.map((transaction) => transaction.date).sort();
  return {
    transactions,
    transactionBlocks: blocks.length,
    ignoredBlocks: blocks.length - transactions.length,
    reconciliation: reconcile(transactions, allLines),
    period: dates.length
      ? { from: dates[0], to: dates[dates.length - 1] }
      : undefined,
  };
}
