import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findService, normalizeMerchant } from '../lib/domain/catalog.ts';
import {
  createKnownSubscriptionCandidate,
  isKnownSubscription,
} from '../lib/domain/known-subscription.ts';
import type { Transaction } from '../lib/domain/types.ts';

test('known subscription candidate does not depend on recurring detection', () => {
  const merchant = 'YANDEX*5815*PLUS MOSCOW RUS';
  const service = findService(merchant);
  assert.equal(service?.id, 'yandex-plus');
  assert.equal(isKnownSubscription(service), true);

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    originalMerchant: merchant,
    normalizedMerchant: normalizeMerchant(merchant),
    amountMinor: 24900,
    currency: 'RUB',
    paidAt: '2026-09-09',
    recurringExpenseId: null,
    sourceImportId: crypto.randomUUID(),
    fingerprint: 'known-yandex-plus',
    occurrence: 0,
    serviceMatchConfidence: 0.99,
  };
  const candidate = createKnownSubscriptionCandidate({
    transaction,
    service: service!,
    importId: transaction.sourceImportId,
    asOf: '2026-09-10',
  });

  assert.equal(candidate.decision, 'pending');
  assert.equal(candidate.expense.serviceId, 'yandex-plus');
  assert.equal(candidate.expense.amountMinor, 24900);
  assert.equal(candidate.expense.recurringConfidence, 0.4);
  assert.ok((candidate.expense.subscriptionConfidence ?? 0) >= 0.9);
  assert.equal(candidate.expense.periodConfidence, 0.2);
  assert.deepEqual(candidate.transactionIds, [transaction.id]);
});
