import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { extractReceipt } from '../lib/gmail/extract.ts';
import type { ParsedReceipt } from '../lib/gmail/types.ts';
const base = 'http://localhost:3000',
  headers = { Cookie: process.env.POTOK_TEST_COOKIE ?? '', Origin: base },
  suffix = Date.now();
async function call(path: string, method = 'GET', payload?: unknown) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...headers,
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  return { status: r.status, data: (await r.json()) as any };
}
async function upload(csv: string) {
  const form = new FormData();
  form.set('file', new File([csv], 'month-' + suffix + '.csv'));
  const r = await fetch(base + '/api/imports', {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await r.json();
  assert.equal(r.status, 201, JSON.stringify(data));
  return data;
}
const initial = await call('/api/gmail/connection');
assert.equal(initial.status, 200);
assert.equal(
  initial.data.configured,
  false,
  'Run this fixture test only on the unconfigured local app',
);
const baselineExpenses = (await call('/api/expenses')).data.length;
assert.equal((await fetch(base + '/api/gmail/connection')).status, 401);
assert.equal((await call('/auth/google/start')).status, 503);
const name = 'Интернет QA ' + suffix;
for (const month of ['06', '07', '08'])
  await upload(
    'date;merchant;amount\n2026-' +
      month +
      '-21;' +
      name +
      ';1000.00\n2026-' +
      month +
      '-22;Пополнение;+9000.00',
  );
const candidates = (await call('/api/candidates')).data;
const bank = candidates.find((c: any) => c.expense.name === name);
assert.ok(bank);
assert.equal(bank.transactionIds.length, 3);
assert.equal(candidates.filter((c: any) => c.expense.name === name).length, 1);
assert.ok(bank.expense.confidence > 0.5);
assert.equal(
  (
    await call('/api/candidates', 'POST', {
      ids: [bank.id],
      decision: 'confirmed',
    })
  ).status,
  200,
);
const sqlite = new DatabaseSync('.local/potok.sqlite');
sqlite.exec('PRAGMA foreign_keys=ON');
const owner = sqlite
  .prepare('SELECT user_id FROM recurring_expenses WHERE id=?')
  .get(bank.expense.id)!.user_id as string;
const other = 'private-test-' + suffix;
sqlite
  .prepare('INSERT INTO users (id,created_at) VALUES (?,?)')
  .run(other, new Date().toISOString());
function seed(receipt: ParsedReceipt, userId = owner) {
  const id = crypto.randomUUID();
  sqlite
    .prepare(
      'INSERT INTO gmail_receipts (id,user_id,message_id,received_at,payload,event_type,decision) VALUES (?,?,?,?,?,?,?)',
    )
    .run(
      id,
      userId,
      receipt.sourceMessageId,
      receipt.receivedAt,
      JSON.stringify(receipt),
      receipt.classification,
      'pending',
    );
  return id;
}
const receivedAt = '2026-08-22T12:00:00.000Z';
const existing = extractReceipt({
  id: 'bank-receipt-' + suffix,
  sender: 'billing@example.test',
  subject: 'Payment receipt',
  text:
    'Service: ' + name + '\nTotal: 1000 RUB\nPayment date: 2026-08-21\nMonthly',
  receivedAt,
})!;
const receiptId = seed(existing);
assert.equal(
  (
    await call('/api/gmail/receipts', 'POST', {
      receiptIds: [receiptId],
      decision: 'confirm',
    })
  ).status,
  200,
);
assert.equal(
  sqlite
    .prepare('SELECT expense_id FROM gmail_receipts WHERE id=?')
    .get(receiptId)!.expense_id,
  bank.expense.id,
);
const service = [
  ['netflix', 'NETFLIX', 'netflix.com'],
  ['spotify', 'SPOTIFY', 'spotify.com'],
  ['adobe', 'ADOBE', 'adobe.com'],
].find(
  ([id]) =>
    sqlite
      .prepare(
        'SELECT COUNT(*) AS n FROM recurring_expenses WHERE user_id=? AND service_id=?',
      )
      .get(owner, id)!.n === 0,
);
assert.ok(service, 'Use a fresh local fixture database');
const [serviceId, merchant, domain] = service;
const receipt = extractReceipt({
  id: 'receipt-' + suffix,
  sender: 'receipt@' + domain,
  subject: 'Your payment receipt',
  text: 'Total: 699 RUB\nPayment date: 2026-08-21\nMonthly\nPlan: Plus\nNext billing: 2026-09-21',
  receivedAt,
})!;
const a = seed(receipt),
  b = seed({ ...receipt, sourceMessageId: 'netflix-duplicate-' + suffix });
const expenseDraft = {
  name: merchant + ' QA ' + suffix,
  type: 'subscription',
  amount: '699',
  currency: 'RUB',
  billingPeriod: 'monthly',
  nextPaymentAt: '2026-09-21',
  serviceId,
  status: 'active',
};
const response = await call('/api/gmail/receipts', 'POST', {
  receiptIds: [a, b],
  decision: 'confirm',
  expense: expenseDraft,
});
assert.equal(response.status, 200, JSON.stringify(response.data));
const netflix = response.data.expenseId;
assert.ok(netflix);
assert.equal(
  (
    await call('/api/gmail/receipts', 'POST', {
      receiptIds: [a, b],
      decision: 'confirm',
      expense: expenseDraft,
    })
  ).data.completed,
  0,
);
await upload('date;merchant;amount\n2026-08-21;' + merchant + ';699.00');
assert.equal(
  sqlite
    .prepare(
      'SELECT recurring_expense_id FROM transactions WHERE user_id=? AND normalized_merchant=? AND amount_minor=69900',
    )
    .get(owner, 'service:' + serviceId)!.recurring_expense_id,
  netflix,
);
assert.equal(
  sqlite
    .prepare(
      'SELECT COUNT(*) AS n FROM recurring_expenses WHERE user_id=? AND service_id=?',
    )
    .get(owner, serviceId)!.n,
  1,
);
const upcoming = seed({
  ...receipt,
  sourceMessageId: 'renewal-' + suffix,
  classification: 'upcoming_payment',
  status: 'unknown',
  paymentDate: null,
  nextPaymentAt: '2026-09-25',
  receivedAt: '2026-08-23T12:00:00.000Z',
});
assert.equal(
  (
    await call('/api/gmail/receipts', 'POST', {
      receiptIds: [upcoming],
      decision: 'confirm',
      targetExpenseId: netflix,
    })
  ).status,
  200,
);
const expenses = (await call('/api/expenses')).data;
assert.equal(
  expenses.find((e: any) => e.id === netflix).nextPaymentAt,
  '2026-09-25',
);
assert.equal(
  expenses.find((e: any) => e.id === netflix).nextPaymentAtSource,
  'provider_email',
);
const cancelled = seed({
  ...receipt,
  sourceMessageId: 'cancel-' + suffix,
  classification: 'subscription_cancelled',
  status: 'cancelled',
  amountMinor: null,
  paymentDate: null,
  nextPaymentAt: null,
});
assert.equal(
  (
    await call('/api/gmail/receipts', 'POST', {
      receiptIds: [cancelled],
      decision: 'events',
      targetExpenseId: netflix,
    })
  ).status,
  200,
);
assert.equal(
  sqlite
    .prepare('SELECT status FROM recurring_expenses WHERE id=?')
    .get(netflix)!.status,
  'active',
);
const event = sqlite
  .prepare('SELECT id FROM gmail_events WHERE receipt_id=?')
  .get(cancelled)!.id;
assert.equal(
  (await call('/api/gmail/events', 'POST', { id: event, action: 'cancel' }))
    .status,
  200,
);
assert.equal(
  sqlite
    .prepare('SELECT status FROM recurring_expenses WHERE id=?')
    .get(netflix)!.status,
  'cancelled',
);
const privateReceipt = seed(
  { ...receipt, sourceMessageId: 'private-' + suffix },
  other,
);
assert.equal(
  (
    await call('/api/gmail/receipts', 'POST', {
      receiptIds: [privateReceipt],
      decision: 'ignore',
    })
  ).status,
  404,
);
assert.equal(
  (await call('/api/gmail/data', 'DELETE', { confirm: 'delete-gmail' })).status,
  200,
);
assert.equal(
  sqlite
    .prepare('SELECT COUNT(*) AS n FROM gmail_receipts WHERE user_id=?')
    .get(owner)!.n,
  0,
);
assert.equal(
  sqlite
    .prepare('SELECT COUNT(*) AS n FROM gmail_receipts WHERE user_id=?')
    .get(other)!.n,
  1,
);
assert.equal(
  sqlite
    .prepare('SELECT COUNT(*) AS n FROM recurring_expenses WHERE user_id=?')
    .get(owner)!.n,
  baselineExpenses + 2,
);
assert.equal(
  sqlite
    .prepare('SELECT COUNT(*) AS n FROM provider_enrichments WHERE user_id=?')
    .get(owner)!.n,
  0,
);
for (const path of [
  '/',
  '/import',
  '/detected',
  '/settings',
  '/settings/sources',
  '/settings/google-setup',
  '/onboarding',
  '/login',
  '/privacy',
  '/terms',
  '/expenses/' + netflix,
]) {
  const r = await fetch(base + path, { headers });
  assert.equal(r.status, 200, path);
}
sqlite.close();
console.log(
  'PASS: automatic signs; short statement grows one candidate; Gmail→bank and bank→Gmail reconciliation; idempotent review; provider date priority; explicit cancellation; owner-scoped deletion; source routes. No real Gmail messages were accessed.',
);
process.exit(0);
