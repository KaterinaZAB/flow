export function searchWindow(
  months: number,
  lastSyncAt: string | null,
  now = new Date(),
) {
  if (![1, 3, 6, 12, 24].includes(months))
    throw new Error('Выберите 1, 3, 6, 12 или 24 месяца.');
  const end = now.toISOString();
  const start = lastSyncAt
    ? new Date(Date.parse(lastSyncAt) - 86400000)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  return { start: start.toISOString(), end };
}
export function candidateQuery(start: string, end: string) {
  const terms = [
    'чек',
    'квитанция',
    'оплата',
    'платеж',
    'платёж',
    'подписка',
    'продлена',
    '"следующее списание"',
    '"пробный период"',
    'тариф',
    'invoice',
    'receipt',
    'subscription',
    'renewed',
    'renewal',
    'payment',
    'charged',
    'billing',
    'trial',
    '"your plan"',
    '"price change"',
    '"изменение стоимости"',
    'from:netflix.com',
    'from:spotify.com',
    'from:openai.com',
    'from:plus.yandex.ru',
  ];
  return (
    '-in:spam -in:trash after:' +
    Math.floor(Date.parse(start) / 1000) +
    ' before:' +
    Math.ceil(Date.parse(end) / 1000) +
    ' {' +
    terms.join(' ') +
    '}'
  );
}
