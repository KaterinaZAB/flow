import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assemblePdfTransactions } from '../lib/import/pdf/assembler.ts';
import {
  genericBankProfile,
  modernSberHints,
} from '../lib/import/pdf/profiles.ts';
import {
  findService,
  merchantBehavior,
  normalizeMerchant,
} from '../lib/domain/catalog.ts';
import { detectRecurring } from '../lib/domain/detection.ts';
import type { Transaction } from '../lib/domain/types.ts';
import { anonymizedSberModernFixture } from './fixtures/sber-modern.ts';

test('anonymized six-page Sber statement reconciles all 109 transaction blocks', () => {
  const parsed = assemblePdfTransactions(
    anonymizedSberModernFixture(),
    modernSberHints,
  );
  const accepted = parsed.transactions.filter(
    (transaction) => !transaction.reviewReasons.length,
  ).length;
  const review = parsed.transactions.length - accepted;
  assert.equal(parsed.transactionBlocks, 109);
  assert.equal(parsed.transactions.length, 109);
  assert.equal(parsed.reconciliation.parsedIncomeMinor, 4_930_100);
  assert.equal(parsed.reconciliation.parsedExpenseMinor, 5_376_255);
  assert.equal(parsed.reconciliation.openingBalanceMinor, 507_575);
  assert.equal(parsed.reconciliation.closingBalanceMinor, 61_420);
  assert.equal(parsed.reconciliation.status, 'exact');
  assert.equal(
    accepted + review + parsed.ignoredBlocks,
    parsed.transactionBlocks,
  );
  assert.equal(review, 0);
});

test('Sber rows keep operation and processing dates separate', () => {
  const parsed = assemblePdfTransactions(
    anonymizedSberModernFixture(),
    modernSberHints,
  );
  const music = parsed.transactions.find((transaction) =>
    transaction.merchant.startsWith('VK*VK MUSIC'),
  );
  assert.ok(music);
  assert.equal(music.date, '2026-05-06');
  assert.equal(music.processedAt, '2026-05-07');
  assert.match(music.authorizationCode ?? '', /^\d{6}$/);
  assert.equal(music.bankCategory, 'Прочие операции');
  assert.equal(findService(music.merchant)?.id, 'vk-music');
});

test('bank hints are optional for the universal assembler', () => {
  const parsed = assemblePdfTransactions(
    anonymizedSberModernFixture(),
    genericBankProfile,
  );
  assert.equal(parsed.transactionBlocks, 109);
  assert.equal(parsed.transactions.length, 109);
  assert.equal(parsed.reconciliation.status, 'exact');
});

test('specific subscription aliases do not capture unrelated Yandex or YM merchants', () => {
  assert.equal(findService('YANDEX*8642*PLUS')?.id, 'yandex-plus');
  assert.equal(findService('YANDEX*MARKET'), undefined);
  assert.equal(findService('YANDEX*GO')?.id, 'yandex-go');
  assert.equal(findService('YM*OKKO MOSCOW RUS')?.id, 'okko');
  assert.equal(findService('YM*URENT MOSCOW RUS')?.id, 'urent');
  assert.equal(findService('CP* START.RU MOSKVA RUS')?.id, 'start');
  assert.equal(findService('MOBILE BANK: KOMISSIYA')?.id, 'mobile-bank-fee');
});

test('usage-based merchants and transfers are never promoted to subscriptions', () => {
  const merchants = ['TUTU4', 'METRO MOSKVA', 'YM*URENT', 'STRELKA_POPOLNENIE'];
  for (const merchant of merchants)
    assert.equal(merchantBehavior(merchant), 'usage_based');
  assert.equal(merchantBehavior('Перевод СБП'), 'transfer');
  const transactions: Transaction[] = Array.from({ length: 19 }, (_, index) => {
    const paidAt = `2026-05-${String(index + 1).padStart(2, '0')}`;
    return {
      id: crypto.randomUUID(),
      originalMerchant: 'TUTU4 MOSCOW RUS',
      normalizedMerchant: normalizeMerchant('TUTU4 MOSCOW RUS'),
      amountMinor: 6100,
      currency: 'RUB',
      paidAt,
      recurringExpenseId: null,
      sourceImportId: 'fixture',
      fingerprint: `${index}`,
      occurrence: 0,
    };
  });
  assert.deepEqual(detectRecurring(transactions, 'fixture', '2026-06-01'), []);
});

test('recurring and subscription confidence remain separate signals', () => {
  const transactions: Transaction[] = [
    '2026-01-21',
    '2026-02-21',
    '2026-03-21',
  ].map((paidAt, index) => ({
    id: `okko-${index}`,
    originalMerchant: 'YM*OKKO',
    normalizedMerchant: normalizeMerchant('YM*OKKO'),
    amountMinor: 39900,
    currency: 'RUB',
    paidAt,
    recurringExpenseId: null,
    sourceImportId: 'fixture',
    fingerprint: `okko-${index}`,
    occurrence: 0,
  }));
  const [candidate] = detectRecurring(transactions, 'fixture', '2026-03-22');
  assert.ok(candidate);
  assert.ok((candidate.expense.recurringConfidence ?? 0) >= 0.5);
  assert.ok(
    (candidate.expense.subscriptionConfidence ?? 0) >
      (candidate.expense.recurringConfidence ?? 0),
  );
});
