import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analytics,
  monthlyEquivalent,
  yearlyEquivalent,
  upcomingPayments,
} from '../lib/domain/analytics.ts';
import type { RecurringExpense } from '../lib/domain/types.ts';
export const expense: RecurringExpense = {
  id: 'e',
  name: 'Test',
  type: 'subscription',
  amountMinor: 39900,
  currency: 'RUB',
  billingPeriod: 'monthly',
  customDays: null,
  nextPaymentAt: '2026-09-10',
  anchorDay: 10,
  status: 'active',
  serviceId: null,
  source: 'manual',
  confidence: null,
  createdAt: '',
  updatedAt: '',
};
test('normalized costs use integer-safe rounding', () => {
  assert.equal(monthlyEquivalent(expense), 39900);
  assert.equal(yearlyEquivalent(expense), 478800);
  assert.equal(
    monthlyEquivalent({
      ...expense,
      billingPeriod: 'weekly',
      amountMinor: 100,
    }),
    433,
  );
  assert.equal(
    yearlyEquivalent({ ...expense, billingPeriod: 'weekly', amountMinor: 100 }),
    5200,
  );
  assert.equal(
    monthlyEquivalent({
      ...expense,
      billingPeriod: 'quarterly',
      amountMinor: 10000,
    }),
    3333,
  );
  assert.equal(
    monthlyEquivalent({
      ...expense,
      billingPeriod: 'yearly',
      amountMinor: 120000,
    }),
    10000,
  );
});
test('cancelled/paused and foreign currencies excluded, no implicit FX', () => {
  const a = analytics(
    [
      expense,
      { ...expense, id: 'c', status: 'cancelled' },
      { ...expense, id: 'p', status: 'paused' },
      { ...expense, id: 'usd', currency: 'USD' },
    ],
    'RUB',
    '2026-09-06',
  );
  assert.equal(a.activeCount, 1);
  assert.equal(a.monthly, 39900);
  assert.equal(a.toMonthEnd, 39900);
  assert.equal(a.upcoming.length, 3);
});
test('forecast enumerates weekly payments, advances stale dates, preserves month end', () => {
  const rows = upcomingPayments(
    [{ ...expense, billingPeriod: 'weekly', nextPaymentAt: '2026-08-01' }],
    '2026-09-01',
    '2026-09-30',
  );
  assert.equal(rows.length, 4);
  assert.deepEqual(
    upcomingPayments(
      [{ ...expense, nextPaymentAt: '2026-01-31', anchorDay: 31 }],
      '2026-02-01',
      '2026-03-31',
    ).map((r) => r.date),
    ['2026-02-28', '2026-03-31'],
  );
});
test('missing dates affect run rate but not fabricated dated payments', () => {
  const a = analytics(
    [{ ...expense, nextPaymentAt: null }],
    'RUB',
    '2026-09-01',
  );
  assert.equal(a.monthly, 39900);
  assert.equal(a.toMonthEnd, 0);
  assert.equal(a.missingDates, 1);
  assert.equal(a.upcoming.length, 0);
});
