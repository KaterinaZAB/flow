import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectRecurring } from '../lib/domain/detection.ts';
import { addPeriod, advanceTo } from '../lib/domain/calendar.ts';
import {
  findService,
  normalizeMerchant,
} from '../lib/domain/catalog.ts';
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
function merchantRows(
  merchant: string,
  dates: string[],
  amounts: number[],
): Transaction[] {
  return dates.map((paidAt, index) => ({
    id: `${merchant}-${index}`,
    originalMerchant: merchant,
    normalizedMerchant: normalizeMerchant(merchant),
    amountMinor: amounts[index % amounts.length],
    currency: 'RUB',
    paidAt,
    recurringExpenseId: null,
    sourceImportId: 'test',
    fingerprint: `${merchant}-${index}`,
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

test('mobile operator aliases resolve without promoting one payment', () => {
  for (const [merchant, serviceId] of [
    ['MTS*PAY MOSCOW RUS', 'mts'],
    ['YM*MTS*PAY MOSCOW RUS', 'mts'],
    ['BEELINE MOSCOW RUS', 'beeline'],
    ['VIMPELCOM 12345', 'beeline'],
    ['MEGAFON*123456', 'megafon'],
    ['YOTA MOSCOW RUS', 'yota'],
  ])
    assert.equal(findService(merchant)?.id, serviceId);

  assert.deepEqual(
    detectRecurring(
      merchantRows('MTS*PAY MOSCOW RUS', ['2026-08-10'], [65000]),
      'i',
      '2026-09-01',
    ),
    [],
  );
});

test('internet and variable utility bills require and use monthly history', () => {
  const [internet] = detectRecurring(
    merchantRows(
      'DOM.RU MOSCOW RUS',
      ['2026-05-12', '2026-06-12', '2026-07-11'],
      [89000],
    ),
    'i',
    '2026-08-01',
  );
  assert.equal(internet.expense.serviceId, 'domru');
  assert.equal(internet.expense.type, 'internet');
  assert.match(internet.reasons[0], /домашний интернет/);

  const [utility] = detectRecurring(
    merchantRows(
      'МОСЭНЕРГОСБЫТ',
      ['2026-04-20', '2026-05-21', '2026-06-20', '2026-07-22'],
      [690000, 720000, 705000, 750000],
    ),
    'i',
    '2026-08-01',
  );
  assert.equal(utility.expense.type, 'utility');
  assert.match(utility.reasons[0], /коммунальный/);
  assert.match(utility.reasons[3], /Сумма меняется/);
});

test('monthly recipient transfer can be reviewed as rent', () => {
  const [candidate] = detectRecurring(
    merchantRows(
      'ПЕРЕВОД ИВАНОВ ИВАН',
      ['2026-05-03', '2026-06-02', '2026-07-03'],
      [5500000, 5500000, 5550000],
    ),
    'i',
    '2026-08-01',
  );
  assert.equal(candidate.expense.type, 'rent');
  assert.equal(candidate.decision, 'pending');
  assert.match(candidate.reasons[0], /оплату жилья/);
});

test('explicit rent description can be reviewed from one payment', () => {
  const [candidate] = detectRecurring(
    merchantRows('Оплата жилья аренда', ['2026-07-03'], [5500000]),
    'i',
    '2026-08-01',
  );
  assert.equal(candidate.expense.type, 'rent');
  assert.equal(candidate.decision, 'pending');
  assert.match(candidate.reasons[0], /явно указывает на аренду/);
});

test('usage-based transport needs a strong repeated pattern', () => {
  assert.equal(findService('WHOOSH MOSCOW RUS')?.id, 'whoosh');
  assert.deepEqual(
    detectRecurring(
      merchantRows('WHOOSH MOSCOW RUS', ['2026-07-10'], [19900]),
      'i',
      '2026-08-01',
    ),
    [],
  );
  const candidates = detectRecurring(
    merchantRows(
      'WHOOSH MOSCOW RUS',
      ['2026-04-10', '2026-05-11', '2026-06-10', '2026-07-09'],
      [19900, 21900, 19900, 22900],
    ),
    'i',
    '2026-08-01',
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].decision, 'pending');
  assert.equal(candidates[0].expense.serviceId, 'whoosh');
  assert.ok((candidates[0].expense.subscriptionConfidence ?? 1) < 0.5);
});

test('digital subscription detection remains available from one payment', () => {
  const [candidate] = detectRecurring(
    merchantRows('YANDEX*9999*PLUS MOSCOW RUS', ['2026-07-09'], [24900]),
    'i',
    '2026-08-01',
  );
  assert.equal(candidate.expense.serviceId, 'yandex-plus');
  assert.ok((candidate.expense.subscriptionConfidence ?? 0) >= 0.9);
});
