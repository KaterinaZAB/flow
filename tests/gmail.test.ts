import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlText, preprocessEmail } from '../lib/gmail/preprocess.ts';
import {
  extractReceipt,
  emailAmounts,
  explicitDate,
} from '../lib/gmail/extract.ts';
import { classifyEmail } from '../lib/gmail/classify.ts';
import { matchEmailService, senderMatches } from '../lib/gmail/matching.ts';
import { searchWindow, candidateQuery } from '../lib/gmail/search.ts';
import {
  matchingBankTransaction,
  matchingExpense,
  freshProviderDate,
} from '../lib/gmail/reconcile.ts';
import { receiptPatterns } from '../lib/gmail/detection.ts';
import { parsedReceiptSchema, type PreparedEmail } from '../lib/gmail/types.ts';
import type { Transaction, RecurringExpense } from '../lib/domain/types.ts';
const email = (subject: string, text: string, id = 'm'): PreparedEmail => ({
  id,
  subject,
  text,
  sender: 'receipts@netflix.com',
  receivedAt: '2026-08-21T12:00:00.000Z',
});
const receipt = (id = 'm', date = '2026-08-21') =>
  extractReceipt(
    email(
      'Your payment receipt',
      'Total: 699.00 RUB\nPayment date: ' +
        date +
        '\nBilled monthly\nNext billing: 2026-09-21',
      id,
    ),
  )!;
test('MIME preprocessing prefers plain text and skips attachments; HTML is never executed', () => {
  const encode = (text: string) => Buffer.from(text).toString('base64url');
  const result = preprocessEmail({
    id: 'm',
    internalDate: String(Date.parse('2026-08-21T12:00:00Z')),
    payload: {
      mimeType: 'multipart/alternative',
      headers: [
        { name: 'From', value: 'Netflix <receipts@netflix.com>' },
        { name: 'Subject', value: 'Receipt' },
      ],
      parts: [
        { mimeType: 'text/plain', body: { data: encode('Total: 699 RUB') } },
        {
          mimeType: 'text/html',
          body: { data: encode('<p>Duplicate amount</p>') },
        },
        {
          mimeType: 'text/plain',
          filename: 'invoice.txt',
          body: { data: encode('Do not parse attachment') },
        },
      ],
    },
  });
  assert.equal(result.text, 'Total: 699 RUB');
  assert.equal(result.sender, 'receipts@netflix.com');
  const text = htmlText(
    '<html><head><style>secret</style></head><body><script>fetch("bad")</script><p>Paid <b>699 ₽</b></p><div style="display:none">tracking secret</div><img src="https://track.test/pixel"><iframe>secret</iframe><p>Next billing &amp; plan</p></body></html>',
  );
  assert.match(text, /Paid 699 ₽/);
  assert.match(text, /Next billing & plan/);
  assert.doesNotMatch(text, /fetch|secret|track.test|<script>/);
});
test('known sender matching respects exact domain boundaries', () => {
  assert.equal(senderMatches('receipt@mail.netflix.com', 'netflix.com'), true);
  assert.equal(
    senderMatches('receipt@netflix.com.attacker.test', 'netflix.com'),
    false,
  );
  assert.equal(matchEmailService(email('Receipt', ''))?.id, 'netflix');
  assert.equal(
    matchEmailService({
      ...email('Netflix receipt', ''),
      sender: 'netflix@attacker.test',
    }),
    null,
  );
});
test('classification recognizes renewal, trial, price and cancellation notices in both languages', () => {
  for (const [subject, expected] of [
    ['Your subscription renewed', 'subscription_renewed'],
    ['Ваша подписка отменена', 'subscription_cancelled'],
    ['Your trial ends on 2026-09-14', 'trial_ending'],
    ['Изменение стоимости тарифа', 'price_changed'],
    ['Upcoming payment', 'upcoming_payment'],
    ['Invoice #42', 'invoice'],
    ['Weekend offers', 'irrelevant'],
  ] as const)
    assert.equal(classifyEmail(email(subject, '')).type, expected);
});
test('a paid receipt stays paid when it also includes next renewal information', () => {
  const r = receipt();
  assert.equal(r.classification, 'payment_receipt');
  assert.equal(r.status, 'paid');
  assert.equal(r.amountMinor, 69900);
  assert.equal(r.currency, 'RUB');
  assert.equal(r.paymentDate, '2026-08-21');
  assert.equal(r.billingPeriod, 'monthly');
  assert.equal(r.nextPaymentAt, '2026-09-21');
  assert.equal(r.serviceId, 'netflix');
  assert.ok(r.confidence > 0.8);
});
test('missing or ambiguous financial fields remain null and schema rejects invented fields', () => {
  const r = extractReceipt(
    email('Subscription confirmed', 'Welcome to your plan'),
  )!;
  assert.equal(r.amountMinor, null);
  assert.equal(r.paymentDate, null);
  assert.equal(r.nextPaymentAt, null);
  assert.equal(r.billingPeriod, null);
  assert.equal(
    parsedReceiptSchema.safeParse({ ...r, untrusted: 'instruction' }).success,
    false,
  );
  assert.equal(
    parsedReceiptSchema.safeParse({ ...r, amountMinor: -1 }).success,
    false,
  );
  const ambiguous = extractReceipt(
    email('Your receipt', '699 RUB and 799 RUB'),
  )!;
  assert.equal(ambiguous.amountMinor, null);
  assert.equal(emailAmounts('$19.99').length, 0);
});
test('explicit localized dates and amounts are parsed without guessing missing years', () => {
  assert.equal(explicitDate('14 сентября 2026'), '2026-09-14');
  assert.equal(explicitDate('September 14, 2026'), '2026-09-14');
  assert.equal(explicitDate('31.02.2026'), null);
  assert.equal(explicitDate('14 сентября'), null);
  assert.equal(emailAmounts('Total: USD 1,999.99')[0].amountMinor, 199999);
  assert.equal(emailAmounts('Итого: 1 999,99 ₽')[0].amountMinor, 199999);
});
test('trial dates, explicit price changes and future renewal are separate events', () => {
  const trial = extractReceipt(
    email(
      'Ваш пробный период заканчивается 14 сентября 2026',
      'Далее ежемесячно. Сумма оплаты: 1 999 ₽',
    ),
  )!;
  assert.equal(trial.trialEndsAt, '2026-09-14');
  assert.equal(trial.status, 'trial');
  assert.equal(trial.paymentDate, null);
  const price = extractReceipt(
    email(
      'Изменение стоимости тарифа',
      'С 01.10.2026 стоимость изменится с 699 ₽ до 899 ₽. Оплата ежемесячно.',
    ),
  )!;
  assert.equal(price.oldAmountMinor, 69900);
  assert.equal(price.newAmountMinor, 89900);
  assert.equal(price.effectiveAt, '2026-10-01');
  assert.equal(price.amountMinor, null);
  assert.equal(price.status, 'unknown');
  const invoice = extractReceipt(
    email('Invoice', 'Total: 699 RUB\nPayment due: 2026-09-21'),
  )!;
  assert.equal(invoice.status, 'unknown');
});
test('bank/Gmail matching uses currency, amount, service, date and rejects ambiguous matches', () => {
  const r = receipt();
  const tx: Transaction = {
    id: 't',
    originalMerchant: 'NETFLIX',
    normalizedMerchant: 'service:netflix',
    amountMinor: 69900,
    currency: 'RUB',
    paidAt: '2026-08-22',
    sourceImportId: 'bank',
    recurringExpenseId: null,
    fingerprint: 'f',
    occurrence: 0,
  };
  assert.equal(matchingBankTransaction(r, [tx])?.id, 't');
  assert.equal(matchingBankTransaction(r, [tx, { ...tx, id: 't2' }]), null);
  assert.equal(matchingBankTransaction(r, [{ ...tx, currency: 'USD' }]), null);
  assert.equal(
    matchingBankTransaction(
      { ...r, status: 'unknown', classification: 'invoice' },
      [tx],
    ),
    null,
  );
  assert.equal(
    matchingBankTransaction({ ...r, amountMinor: 89900 }, [tx]),
    null,
  );
  const exp = {
    id: 'e',
    name: 'Netflix',
    serviceId: 'netflix',
    currency: 'RUB',
  } as RecurringExpense;
  assert.equal(matchingExpense(r, [exp])?.id, 'e');
  assert.equal(matchingExpense(r, [exp, { ...exp, id: 'e2' }]), null);
});
test('receipt duplication does not invent repeat payments; independent monthly receipts produce a pattern', () => {
  assert.equal(
    receiptPatterns([receipt('a'), receipt('b')], '2026-09-06').length,
    0,
  );
  const patterns = receiptPatterns(
    [
      receipt('a', '2026-06-21'),
      receipt('b', '2026-07-21'),
      receipt('c', '2026-08-21'),
      receipt('duplicate', '2026-08-21'),
    ],
    '2026-09-06',
  );
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].transactionIds.length, 3);
  assert.equal(patterns[0].expense.billingPeriod, 'monthly');
});
test('provider dates need fresh known evidence; stale or past notices do not override predictions', () => {
  const r = receipt();
  assert.equal(freshProviderDate(r, '2026-09-06'), true);
  assert.equal(
    freshProviderDate({ ...r, knownSender: false }, '2026-09-06'),
    false,
  );
  assert.equal(
    freshProviderDate({ ...r, nextPaymentAt: '2026-08-01' }, '2026-09-06'),
    false,
  );
  assert.equal(
    freshProviderDate(
      { ...r, receivedAt: '2026-01-01T12:00:00.000Z' },
      '2026-09-06',
    ),
    false,
  );
});
test('incremental searches have fixed bounds, limited history and overlap without full mailbox fetch', () => {
  const initial = searchWindow(12, null, new Date('2026-09-06T12:00:00Z'));
  const query = candidateQuery(initial.start, initial.end);
  assert.match(query, /-in:spam -in:trash after:\d+ before:\d+/);
  assert.match(query, /from:netflix.com/);
  assert.match(query, /квитанция/);
  const next = searchWindow(
    12,
    '2026-09-05T12:00:00Z',
    new Date('2026-09-06T12:00:00Z'),
  );
  assert.equal(next.start, '2026-09-04T12:00:00.000Z');
  assert.throws(() => searchWindow(100, null));
});
