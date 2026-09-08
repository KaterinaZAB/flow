import { parseMinor } from '../domain/money.ts';
import type { PreparedEmail, ParsedReceipt } from './types.ts';
import { parsedReceiptSchema } from './types.ts';
import { matchEmailService } from './matching.ts';
import { classifyEmail } from './classify.ts';
const monthNames: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
};
export function explicitDate(value: string): string | null {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const dmy = value.match(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/);
  let result =
    iso?.[0] ??
    (dmy
      ? dmy[3] + '-' + dmy[2].padStart(2, '0') + '-' + dmy[1].padStart(2, '0')
      : null);
  if (!result) {
    const names = Object.keys(monthNames).join('|');
    const a = value
      .toLowerCase()
      .match(new RegExp('\\b(\\d{1,2})\\s+(' + names + ')\\s+(20\\d{2})'));
    const b = value
      .toLowerCase()
      .match(new RegExp('(' + names + ')\\s+(\\d{1,2}),?\\s+(20\\d{2})'));
    if (a)
      result =
        a[3] +
        '-' +
        String(monthNames[a[2]]).padStart(2, '0') +
        '-' +
        a[1].padStart(2, '0');
    else if (b)
      result =
        b[3] +
        '-' +
        String(monthNames[b[1]]).padStart(2, '0') +
        '-' +
        b[2].padStart(2, '0');
  }
  return result &&
    !Number.isNaN(Date.parse(result)) &&
    new Date(result).toISOString().slice(0, 10) === result
    ? result
    : null;
}
const number =
  '(?:\\d{1,3}(?:[ ,\\u00a0\\u202f]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
const currencyCode =
  '(?:RUB|RUR|USD|US\\$|EUR|GBP|KZT|BYN|GEL|TRY|₽|руб\\.?|€|£)';
const moneyRegex = new RegExp(
  '(' +
    number +
    ')\\s*(' +
    currencyCode +
    ')|(' +
    currencyCode +
    ')\\s*(' +
    number +
    ')',
  'gi',
);
function currency(value: string) {
  const text = value.toUpperCase();
  return /RUB|RUR|РУБ|₽/.test(text)
    ? 'RUB'
    : text === 'US$'
      ? 'USD'
      : text === '€'
        ? 'EUR'
        : text === '£'
          ? 'GBP'
          : text;
}
function numeric(value: string) {
  let text = value.replace(/[ \u00a0\u202f]/g, '');
  if (text.includes(',') && text.includes('.')) text = text.replace(/,/g, '');
  else if (/^\d{1,3}(?:,\d{3})+$/.test(text)) text = text.replace(/,/g, '');
  return parseMinor(text);
}
export function emailAmounts(text: string) {
  return [...text.matchAll(moneyRegex)]
    .flatMap((m) => {
      try {
        return [
          {
            amountMinor: numeric(m[1] ?? m[4]),
            currency: currency(m[2] ?? m[3]),
            index: m.index ?? 0,
          },
        ];
      } catch {
        return [];
      }
    })
    .filter((v) => v.amountMinor > 0);
}
function period(text: string): ParsedReceipt['billingPeriod'] {
  if (/quarterly|every 3 months|ежеквартальн|раз в квартал/i.test(text))
    return 'quarterly';
  if (/annually|yearly|per year|ежегодн|раз в год/i.test(text)) return 'yearly';
  if (/weekly|per week|еженедельн/i.test(text)) return 'weekly';
  if (/monthly|per month|ежемесячн|каждый месяц|\/\s*мес/i.test(text))
    return 'monthly';
  return null;
}
export function extractReceipt(email: PreparedEmail): ParsedReceipt | null {
  const classified = classifyEmail(email);
  if (classified.type === 'irrelevant') return null;
  const service = matchEmailService(email);
  const text = email.subject + '\n' + email.text;
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const amountLine = lines.find(
    (l) =>
      /total|amount paid|you paid|charged|итого|сумма (?:оплаты|платежа)|оплачено|списано/i.test(
        l,
      ) && emailAmounts(l).length === 1,
  );
  const all = emailAmounts(text);
  const unique = [
    ...new Map(all.map((a) => [a.currency + ':' + a.amountMinor, a])).values(),
  ];
  const amount = amountLine
    ? emailAmounts(amountLine)[0]
    : unique.length === 1
      ? unique[0]
      : null;
  const dated = (regex: RegExp) => {
    for (const line of lines.filter((l) => regex.test(l))) {
      const date = explicitDate(line);
      if (date) return date;
    }
    return null;
  };
  const paymentDate = dated(
    /payment date|paid (?:on|at)|charged on|дата (?:платежа|оплаты)|оплачено|списано/i,
  );
  const nextPaymentAt = dated(
    /next (?:payment|billing|charge|renewal)|renews? on|will renew|следующ[а-яё]* (?:списание|плат[её]ж)|будет продлена|дата продления/i,
  );
  const trialEndsAt = dated(
    /trial.*(?:ends?|expires?)|пробн.*(?:заканч|заверш|истека)/i,
  );
  const priceLine = lines.find(
    (l) =>
      /(?:from|с)\s+\d[^\n]{0,60}(?:to|до|на)\s+\d/i.test(l) &&
      emailAmounts(l).length >= 2,
  );
  const prices = priceLine ? emailAmounts(priceLine) : [];
  const effectiveAt =
    classified.type === 'price_changed'
      ? dated(/effective|starting|с\s+\d|с\s+\w|начиная/i)
      : null;
  const merchant =
    service?.name ??
    text
      .match(/(?:merchant|service|сервис|поставщик)\s*:\s*([^\n]{2,120})/i)?.[1]
      ?.trim() ??
    null;
  const planName =
    text.match(/(?:plan|тариф)\s*:\s*([^\n]{2,120})/i)?.[1]?.trim() ?? null;
  const billingPeriod = period(text);
  const reasons = [
    classified.reason,
    service
      ? 'Отправитель соответствует домену известного сервиса.'
      : 'Отправитель не сопоставлен с каталогом; проверьте сервис.',
    amount
      ? 'Сумма и валюта указаны в письме.'
      : 'Однозначная сумма и валюта не найдены.',
    billingPeriod ? 'Период оплаты явно указан.' : 'Период оплаты не указан.',
  ];
  const payload = {
    sourceMessageId: email.id,
    serviceId: service?.id ?? null,
    serviceName: service?.name ?? null,
    sender: email.sender,
    merchant,
    planName,
    amountMinor:
      classified.type === 'price_changed'
        ? null
        : (amount?.amountMinor ?? null),
    currency: amount?.currency ?? prices[1]?.currency ?? null,
    paymentDate,
    billingPeriod,
    nextPaymentAt,
    trialEndsAt,
    oldAmountMinor:
      prices.length === 2 && prices[0].currency === prices[1].currency
        ? prices[0].amountMinor
        : null,
    newAmountMinor:
      prices.length === 2 && prices[0].currency === prices[1].currency
        ? prices[1].amountMinor
        : null,
    effectiveAt,
    status:
      classified.type === 'payment_receipt'
        ? 'paid'
        : classified.type === 'subscription_renewed'
          ? 'renewed'
          : classified.type.startsWith('trial_')
            ? 'trial'
            : classified.type === 'subscription_cancelled'
              ? 'cancelled'
              : 'unknown',
    classification: classified.type,
    confidence: Math.min(
      0.97,
      0.4 +
        (service ? 0.2 : 0) +
        (amount ? 0.12 : 0) +
        (billingPeriod ? 0.1 : 0) +
        (paymentDate || nextPaymentAt || trialEndsAt ? 0.08 : 0),
    ),
    reasons,
    receivedAt: email.receivedAt,
    knownSender: !!service,
  };
  const parsed = parsedReceiptSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
