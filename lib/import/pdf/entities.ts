import { matchService } from '../../domain/catalog.ts';
import { parseMinor } from '../../domain/money.ts';
import { normalizeAmountSign } from '../direction.ts';
import type { BankStatementProfile } from './profiles.ts';
import type { PdfTextItem, VisualLine } from './layout.ts';

export const pdfDatePattern =
  /\b(\d{2}[./]\d{2}[./](?:\d{2}|\d{4})|\d{4}-\d{2}-\d{2})\b/;
export const pdfTimePattern = /\b([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/;
export const pdfMoneyPattern =
  /(?<![\d.,])([+−–—﹣－＋-]?\s*(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d{2}|(?=\s*(?:₽|€|\$|RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY))))(?![\d.,])/gi;

export type FinancialEntityType =
  | 'date'
  | 'time'
  | 'money'
  | 'currency'
  | 'merchant'
  | 'category'
  | 'authorization_code'
  | 'card_number';

export type FinancialEntity = {
  id: string;
  type: FinancialEntityType;
  value: string | number;
  page: number;
  x: number;
  y: number;
  width: number;
  rawText: string;
  confidence: number;
  serviceId?: string;
  serviceMatchConfidence?: number;
};

export type PdfEntityDocument = {
  pages: VisualLine[][];
  entities: FinancialEntity[];
};

const normalizedLabel = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.:]+$/g, '')
    .trim();

function isoDate(value: string) {
  if (value.includes('-')) return value;
  const [day, month, shortYear] = value.split(/[./]/);
  const year =
    shortYear.length === 2
      ? (Number(shortYear) >= 70 ? '19' : '20') + shortYear
      : shortYear;
  return `${year}-${month}-${day}`;
}

function parseMoney(value: string) {
  try {
    return Math.abs(
      parseMinor(
        normalizeAmountSign(value)
          .replace(/[₽€$]|\b(?:RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b/gi, '')
          .replace(/\s/g, '')
          .replace(',', '.'),
      ),
    );
  } catch {
    return undefined;
  }
}

export function cleanPdfMerchantText(text: string) {
  return text
    .normalize('NFKC')
    .replace(pdfDatePattern, ' ')
    .replace(pdfTimePattern, ' ')
    .replace(pdfMoneyPattern, ' ')
    .replace(/\b(?:RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b|₽|€|\$/gi, ' ')
    .replace(/^\s*\d{5,6}\s+/, '')
    .replace(
      /(?:[.,]\s*)?(?:операция\s+по\s+(?:карте|сч[её]ту)|карта|card)\s+\*{2,}\d{2,}.*$/i,
      '',
    )
    .replace(/(?:[.,]\s*)?операция\s+по\s+(?:карте|сч[её]ту)\s*$/i, '')
    .replace(/\s+\*{2,}\d{2,}\s*$/i, '')
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

function entity(
  type: FinancialEntityType,
  value: string | number,
  page: number,
  item: PdfTextItem,
  confidence: number,
  offsetRatio = 0,
): FinancialEntity {
  return {
    id: `${page}:${type}:${item.x}:${item.y}:${offsetRatio}`,
    type,
    value,
    page,
    x: item.x + item.width * offsetRatio,
    y: item.y,
    width: item.width,
    rawText: item.text,
    confidence,
  };
}

function extractItemEntities(
  item: PdfTextItem,
  page: number,
  profile: BankStatementProfile,
) {
  const result: FinancialEntity[] = [];
  const text = item.text.trim();
  if (!text) return result;
  const date = text.match(pdfDatePattern)?.[0];
  if (date) result.push(entity('date', isoDate(date), page, item, 0.99));
  const time = text.match(pdfTimePattern)?.[0];
  if (time) result.push(entity('time', time, page, item, 0.99));
  const authorizationCode = text
    .replace(pdfDatePattern, ' ')
    .match(/(?:^|\s)(\d{5,6})(?=\s|$)/)?.[1];
  if (authorizationCode)
    result.push(
      entity('authorization_code', authorizationCode, page, item, 0.96),
    );
  if (/\*{2,}\d{2,}/.test(text))
    result.push(entity('card_number', text, page, item, 0.98));
  const explicitCurrency = text.match(
    /\b(RUB|RUR|USD|EUR|GBP|KZT|BYN|GEL|TRY)\b|₽|€|\$/i,
  )?.[0];
  if (explicitCurrency)
    result.push(
      entity('currency', explicitCurrency.toUpperCase(), page, item, 0.99),
    );
  for (const match of text.matchAll(pdfMoneyPattern)) {
    const value = parseMoney(match[1]);
    if (value === undefined) continue;
    const found = entity(
      'money',
      value,
      page,
      item,
      0.92,
      (match.index ?? 0) / Math.max(1, text.length),
    );
    found.width = item.width * (match[1].length / Math.max(1, text.length));
    result.push(found);
  }
  pdfMoneyPattern.lastIndex = 0;
  const label = normalizedLabel(text);
  if (profile.knownCategoryLabels.includes(label))
    result.push(entity('category', text, page, item, 0.98));
  const merchant = cleanPdfMerchantText(text);
  const serviceMatch = merchant ? matchService(merchant) : undefined;
  if (serviceMatch) {
    const found = entity('merchant', merchant, page, item, 0.99);
    found.serviceId = serviceMatch.service.id;
    found.serviceMatchConfidence = serviceMatch.confidence;
    result.push(found);
  } else if (
    merchant.length >= 2 &&
    !date &&
    !time &&
    !profile.knownCategoryLabels.includes(normalizedLabel(merchant)) &&
    !/^(?:\d+|дата|время|категория|описание|операция|сумма|остаток|баланс|страница|page)$/i.test(
      merchant,
    )
  ) {
    result.push(entity('merchant', merchant, page, item, 0.62));
  }
  return result;
}

export function extractFinancialEntities(
  pages: VisualLine[][],
  profile: BankStatementProfile,
): PdfEntityDocument {
  const entities = pages.flatMap((lines, pageIndex) =>
    lines.flatMap((line) =>
      line.cells.flatMap((item) =>
        extractItemEntities(item, pageIndex + 1, profile),
      ),
    ),
  );
  return { pages, entities };
}
