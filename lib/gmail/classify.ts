import type { PreparedEmail, EmailFinancialEventType } from './types.ts';
const patterns: [EmailFinancialEventType, RegExp][] = [
  [
    'subscription_cancelled',
    /subscription (?:has been |is )?cancel(?:led|ed)|подписк[аиу][^\n]{0,30}отмен|отмена подписки|автопродление[^\n]{0,20}отключ/i,
  ],
  [
    'price_changed',
    /price (?:change|increase)|new price|стоимост[ьи][^\n]{0,45}(?:измен|увелич)|изменение (?:цены|стоимости)|подорож/i,
  ],
  [
    'trial_ending',
    /trial[^\n]{0,45}(?:ends?|ending|expires?)|пробн[^\n]{0,45}(?:заканч|заверш|истека)/i,
  ],
  [
    'trial_started',
    /trial (?:has )?start|free trial|пробн[^\n]{0,35}(?:начал|активирован)/i,
  ],
  [
    'upcoming_payment',
    /upcoming (?:payment|charge|renewal)|next (?:payment|billing|charge)|will (?:be charged|renew)|следующ[а-яё]* (?:списание|плат[её]ж|оплата)|будет продлена|предстоящ[а-яё]* списан/i,
  ],
  [
    'subscription_renewed',
    /(?:subscription|plan)[^\n]{0,25}(?:has been )?renewed|подписк[аиу][^\n]{0,25}продлен/i,
  ],
  [
    'subscription_created',
    /subscription (?:confirmed|created|activated)|подписк[аиу][^\n]{0,25}(?:оформлен|подключен)/i,
  ],
  [
    'payment_receipt',
    /payment (?:received|successful|confirmation)|receipt|you (?:paid|were charged)|успешн[а-яё]* оплат|оплата (?:прошла|получена)|кассовый чек|квитанция об оплате|плат[её]ж выполнен/i,
  ],
  ['invoice', /invoice|сч[её]т на оплату|квитанция|чек/i],
];
export function classifyEmail(email: PreparedEmail) {
  const text = email.subject + '\n' + email.text.slice(0, 30000);
  const subjectMatch = patterns.find(([, pattern]) =>
    pattern.test(email.subject),
  );
  const paid = patterns.find(
    ([type, pattern]) => type === 'payment_receipt' && pattern.test(text),
  );
  const match =
    subjectMatch?.[0] === 'invoice'
      ? (paid ?? subjectMatch)
      : (subjectMatch ??
        paid ??
        patterns.find(([, pattern]) => pattern.test(text)));
  return {
    type: match?.[0] ?? 'irrelevant',
    reason: match
      ? 'В письме есть явное уведомление о финансовом событии.'
      : 'Не найдено признаков чека или события подписки.',
  };
}
