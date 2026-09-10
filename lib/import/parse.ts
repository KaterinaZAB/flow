import { pdfRowsToTable } from './pdf.ts';
import { amountDirection, normalizeAmountSign } from './direction.ts';
import { parseMinor } from '../domain/money.ts';
import { validDate } from '../domain/validation.ts';
import { currencies, type Transaction } from '../domain/types.ts';
import { normalizeMerchant } from '../domain/catalog.ts';
import { decodeCsv, parseCsv } from './csv.ts';
import { parseXlsx } from './xlsx.ts';
export type ImportOptions = {
  amountMode?: 'auto' | 'negative' | 'positive';
  currency: string;
  pdfRows?: unknown;
  mapping?: {
    date: number;
    merchant: number;
    amount: number;
    currency?: number;
    direction?: number;
    bankCategory?: number;
    time?: number;
    processedAt?: number;
    authorizationCode?: number;
    rawDescription?: number;
    serviceMatchConfidence?: number;
    transactionConfidence?: number;
    parseConfidence?: number;
    parseReviewReasons?: number;
  };
};
export type ParseResult = {
  transactions: Transaction[];
  skipped: number;
  warnings: string[];
  headers: string[];
};
const aliases = {
  date: [
    'date',
    'paidat',
    'paymentdate',
    'дата',
    'датаоперации',
    'датаплатежа',
    'датапроводки',
  ],
  merchant: [
    'merchant',
    'description',
    'name',
    'получатель',
    'описание',
    'описаниеоперации',
    'назначениеплатежа',
    'контрагент',
    'наименованиеполучателя',
  ],
  amount: [
    'amount',
    'сумма',
    'суммаоперации',
    'суммаввалютесчета',
    'суммаввалютеоперации',
    'расход',
    'списание',
    'debit',
  ],
  currency: ['currency', 'валюта', 'валютаоперации', 'валютасчета'],
  direction: ['direction', 'типоперации', 'направление', 'тип'],
  bankCategory: ['bankcategory', 'категория', 'категориябанка'],
  time: ['time', 'время', 'времяоперации'],
  processedAt: ['processedat', 'датаобработки'],
  authorizationCode: ['authorizationcode', 'кодавторизации'],
  rawDescription: ['rawdescription', 'исходноеописание'],
  serviceMatchConfidence: ['servicematchconfidence'],
  transactionConfidence: ['transactionconfidence'],
  parseConfidence: ['parseconfidence'],
  parseReviewReasons: ['parsereviewreasons'],
};
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
export class MappingError extends Error {
  headers: string[];
  constructor(headers: string[]) {
    super('Не удалось определить столбцы. Укажите их соответствие.');
    this.headers = headers;
  }
}
export function importDate(value: string): string {
  const s = value.trim().split(/[T ]/)[0];
  if (validDate(s)) return s;
  const m = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(s);
  if (m) {
    const iso = m[3] + '-' + m[2] + '-' + m[1];
    if (validDate(iso)) return iso;
  }
  if (/^\d{5}(?:\.\d+)?$/.test(s)) {
    const date = new Date(
      Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    if (validDate(date)) return date;
  }
  throw new Error('Некорректная дата операции.');
}
async function hash(text: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export async function parseStatement(
  bytes: Uint8Array,
  filename: string,
  importId: string,
  options: ImportOptions,
): Promise<ParseResult> {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength >
      (filename.toLowerCase().endsWith('.pdf') ? 5 : 2) * 1024 * 1024
  )
    throw new Error('Выберите файл размером до 2 МБ.');
  if (
    !currencies.includes(options.currency as never) ||
    !['auto', 'negative', 'positive'].includes(options.amountMode ?? 'auto')
  )
    throw new Error('Некорректные настройки импорта.');
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'pdf')
    throw new Error('Поддерживаются PDF, CSV и XLSX.');
  if (
    ext === 'pdf' &&
    new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-'
  )
    throw new Error('Файл не является PDF.');
  const rows =
    ext === 'pdf'
      ? pdfRowsToTable(options.pdfRows)
      : ext === 'csv'
        ? parseCsv(decodeCsv(bytes))
        : parseXlsx(bytes);
  if (rows.length < 2) throw new Error('В выписке нет операций.');
  let headerIndex = rows
    .slice(0, 30)
    .findIndex(
      (r) =>
        r.some((c) => aliases.date.includes(key(c))) &&
        r.some((c) => aliases.amount.includes(key(c))),
    );
  if (headerIndex < 0) headerIndex = 0;
  const headers = rows[headerIndex];
  const auto = Object.fromEntries(
    Object.entries(aliases).map(([name, values]) => [
      name,
      headers.findIndex((h) => values.includes(key(h))),
    ]),
  ) as Record<string, number>;
  const mapping = options.mapping ?? auto;
  if (
    [mapping.date, mapping.merchant, mapping.amount].some(
      (i) => !Number.isInteger(i) || i < 0 || i >= headers.length,
    )
  )
    throw new MappingError(headers);
  const amountHeader = key(headers[mapping.amount]);
  const debitColumn = ['расход', 'списание', 'debit'].includes(amountHeader);
  const transactions: Transaction[] = [],
    warnings: string[] = [],
    occurrences = new Map<string, number>();
  let skipped = 0;
  for (let rowNo = headerIndex + 1; rowNo < rows.length; rowNo++) {
    const row = rows[rowNo];
    if (row.every((v) => !v.trim())) continue;
    try {
      const originalMerchant = (row[mapping.merchant] ?? '').trim();
      if (
        originalMerchant.length < 2 ||
        originalMerchant.length > 240 ||
        /^[=+@\t\r]/.test(originalMerchant)
      )
        throw new Error('Некорректное описание операции.');
      const rawAmount = normalizeAmountSign(row[mapping.amount] ?? '');
      if (!rawAmount.trim()) {
        skipped++;
        continue;
      }
      const signed = parseMinor(rawAmount);
      const direction =
        mapping.direction !== undefined && mapping.direction >= 0
          ? key(row[mapping.direction] ?? '')
          : '';
      let expense: boolean;
      if (
        [
          'debit',
          'expense',
          'расход',
          'списание',
          'покупка',
          'оплата',
        ].includes(direction)
      )
        expense = true;
      else if (
        [
          'credit',
          'income',
          'доход',
          'пополнение',
          'зачисление',
          'возврат',
          'refund',
        ].includes(direction)
      )
        expense = false;
      else if (direction) throw new Error('Неизвестный тип операции.');
      else if (options.amountMode === 'negative')
        expense = debitColumn ? signed !== 0 : signed < 0;
      else if (options.amountMode === 'positive') expense = signed > 0;
      else expense = amountDirection(rawAmount) === 'expense';
      if (!expense || signed === 0) {
        skipped++;
        continue;
      }
      const paidAt = importDate(row[mapping.date] ?? '');
      if (paidAt > new Date().toISOString().slice(0, 10))
        throw new Error('Дата операции в будущем.');
      const currencyIndex = mapping.currency;
      let currency =
        currencyIndex !== undefined && currencyIndex >= 0
          ? (row[currencyIndex] ?? '').trim().toUpperCase()
          : options.currency;
      currency = currency === 'RUR' || currency === '₽' ? 'RUB' : currency;
      if (!currencies.includes(currency as never))
        throw new Error('Неподдерживаемая валюта.');
      const normalizedMerchant = normalizeMerchant(originalMerchant);
      if (!normalizedMerchant) throw new Error('Пустое описание операции.');
      const amountMinor = Math.abs(signed);
      const fingerprint = await hash(
        [normalizedMerchant, paidAt, amountMinor, currency].join('|'),
      );
      const occurrence = occurrences.get(fingerprint) ?? 0;
      occurrences.set(fingerprint, occurrence + 1);
      transactions.push({
        id: crypto.randomUUID(),
        originalMerchant,
        ...(mapping.bankCategory !== undefined && mapping.bankCategory >= 0
          ? {
              bankCategory:
                (row[mapping.bankCategory] ?? '').trim() || undefined,
            }
          : {}),
        ...(mapping.time !== undefined && mapping.time >= 0
          ? { transactionTime: (row[mapping.time] ?? '').trim() || undefined }
          : {}),
        ...(mapping.processedAt !== undefined && mapping.processedAt >= 0
          ? {
              processedAt: (row[mapping.processedAt] ?? '').trim() || undefined,
            }
          : {}),
        ...(mapping.authorizationCode !== undefined &&
        mapping.authorizationCode >= 0
          ? {
              authorizationCode:
                (row[mapping.authorizationCode] ?? '').trim() || undefined,
            }
          : {}),
        ...(mapping.rawDescription !== undefined && mapping.rawDescription >= 0
          ? {
              rawDescription:
                (row[mapping.rawDescription] ?? '').trim() || undefined,
            }
          : {}),
        ...(mapping.serviceMatchConfidence !== undefined &&
        mapping.serviceMatchConfidence >= 0
          ? {
              serviceMatchConfidence:
                Number(row[mapping.serviceMatchConfidence]) >= 0 &&
                Number(row[mapping.serviceMatchConfidence]) <= 1
                  ? Number(row[mapping.serviceMatchConfidence])
                  : undefined,
            }
          : {}),
        ...(mapping.transactionConfidence !== undefined &&
        mapping.transactionConfidence >= 0
          ? {
              transactionConfidence:
                Number(row[mapping.transactionConfidence]) >= 0 &&
                Number(row[mapping.transactionConfidence]) <= 1
                  ? Number(row[mapping.transactionConfidence])
                  : undefined,
            }
          : {}),
        ...(mapping.parseConfidence !== undefined &&
        mapping.parseConfidence >= 0
          ? {
              parseConfidence:
                Number(row[mapping.parseConfidence]) >= 0 &&
                Number(row[mapping.parseConfidence]) <= 1
                  ? Number(row[mapping.parseConfidence])
                  : undefined,
            }
          : {}),
        ...(mapping.parseReviewReasons !== undefined &&
        mapping.parseReviewReasons >= 0
          ? {
              parseReviewReasons: (row[mapping.parseReviewReasons] ?? '')
                .split(',')
                .filter(Boolean),
            }
          : {}),
        normalizedMerchant,
        amountMinor,
        currency,
        paidAt,
        recurringExpenseId: null,
        sourceImportId: importId,
        fingerprint,
        occurrence,
      });
    } catch (e) {
      skipped++;
      if (warnings.length < 10)
        warnings.push('Строка ' + (rowNo + 1) + ': ' + (e as Error).message);
    }
  }
  if (transactions.length > 10000)
    throw new Error('Максимум 10 000 операций за один импорт.');
  if (!transactions.length)
    throw new Error(
      'Не найдено расходов. Проверьте знак суммы, столбцы и даты.',
    );
  return { transactions, skipped, warnings, headers };
}
