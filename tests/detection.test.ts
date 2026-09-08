import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRecurring } from '../lib/domain/detection.ts';
import { addPeriod, advanceTo } from '../lib/domain/calendar.ts';
import type { Transaction } from '../lib/domain/types.ts';
function rows(
  dates: string[],
  amounts = [39900],
  merchant = 'service:yandex-plus',
): Transaction[] {
  return dates.map((paidAt, i) => ({
    id: String(i),
    originalMerchant: merchant,
    normalizedMerchant: merchant,
    amountMinor: amounts[i % amounts.length],
    currency: 'RUB',
    paidAt,
    recurringExpenseId: null,
    sourceImportId: 'test',
    fingerprint: String(i),
    occurrence: 0,
  }));
}
test('calendar months handle 31 January, February and March without drift', () => {
  const c = detectRecurring(
    rows(['2026-01-31', '2026-02-28', '2026-03-31']),
    'i',
    '2026-04-01',
  )[0];
  assert.equal(c.expense.billingPeriod, 'monthly');
  assert.equal(c.expense.nextPaymentAt, '2026-04-30');
  assert.equal(addPeriod('2026-04-30', 'monthly', 1, 31), '2026-05-31');
});
test('monthly jitter and variable utilities are recurring', () => {
  const c = detectRecurring(
    rows(
      ['2026-05-21', '2026-06-20', '2026-07-22', '2026-08-21'],
      [690000, 735000, 712000, 748000],
      'ЖКХ',
    ),
    'i',
    '2026-09-06',
  )[0];
  assert.equal(c.expense.billingPeriod, 'monthly');
  assert.equal(c.expense.type, 'utility');
  assert.equal(c.expense.amountMinor, 723500);
  assert.equal(c.expense.nextPaymentAt, '2026-09-21');
  assert.ok(c.reasons.length >= 4);
});
test('price increase 699 to 999 does not destroy pattern', () => {
  const c = detectRecurring(
    rows(['2026-06-10', '2026-07-10', '2026-08-10'], [69900, 69900, 99900]),
    'i',
    '2026-09-06',
  )[0];
  assert.equal(c.expense.amountMinor, 99900);
  assert.equal(c.expense.billingPeriod, 'monthly');
});
test('weekly quarterly and yearly frequencies', () => {
  for (const [dates, period] of [
    [['2026-08-07', '2026-08-14', '2026-08-21', '2026-08-28'], 'weekly'],
    [['2026-01-15', '2026-04-16', '2026-07-15'], 'quarterly'],
    [['2024-07-01', '2025-07-01', '2026-07-02'], 'yearly'],
  ] as const) {
    assert.equal(
      detectRecurring(rows([...dates]), 'i', '2026-09-06')[0].expense
        .billingPeriod,
      period,
    );
  }
});
test('one-off, irregular and same-day purchases are not automatic candidates', () => {
  assert.equal(
    detectRecurring(rows(['2026-08-21'], [39900], 'STORE'), 'i').length,
    0,
  );
  assert.equal(
    detectRecurring(
      rows(
        ['2026-01-03', '2026-01-04', '2026-01-17', '2026-02-25', '2026-04-19'],
        [39900],
        'STORE',
      ),
      'i',
    ).length,
    0,
  );
  assert.equal(
    detectRecurring(rows(['2026-08-21', '2026-08-21', '2026-08-21']), 'i')
      .length,
    0,
  );
});
test('currencies never merge and forecasts roll to future', () => {
  const r = rows(['2026-05-10', '2026-06-10', '2026-07-10']);
  r[2].currency = 'USD';
  assert.equal(
    detectRecurring(r, 'i', '2026-09-06')[0].transactionIds.length,
    2,
  );
  assert.equal(
    advanceTo('2026-01-31', 'monthly', '2026-09-06', 31),
    '2026-09-30',
  );
});
