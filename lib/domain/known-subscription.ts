import { addPeriod, advanceTo, today } from './calendar.ts';
import type { Candidate, Service, Transaction } from './types.ts';

export function isKnownSubscription(service: Service | undefined) {
  return (
    service?.merchantClass === 'subscription' ||
    service?.category === 'subscription'
  );
}

/**
 * Creates a review candidate from deterministic service-catalog evidence.
 * A single payment identifies the service, but does not prove its cadence.
 */
export function createKnownSubscriptionCandidate({
  transaction,
  service,
  importId,
  asOf = today(),
}: {
  transaction: Transaction;
  service: Service;
  importId: string;
  asOf?: string;
}): Candidate {
  const anchor = Number(transaction.paidAt.slice(8));
  const now = new Date().toISOString();
  const recurringConfidence = 0.4;
  return {
    id: crypto.randomUUID(),
    importId,
    expense: {
      id: crypto.randomUUID(),
      name: service.name,
      type: service.category,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      billingPeriod: 'monthly',
      customDays: null,
      nextPaymentAt: advanceTo(
        addPeriod(transaction.paidAt, 'monthly', 1, anchor),
        'monthly',
        asOf,
        anchor,
      ),
      anchorDay: anchor,
      status: 'active',
      serviceId: service.id,
      source: 'bank-import',
      nextPaymentAtSource: 'transaction_prediction',
      recurringConfidence,
      subscriptionConfidence: Math.max(
        0.9,
        transaction.serviceMatchConfidence ?? 0,
      ),
      periodConfidence: 0.2,
      confidence: recurringConfidence,
      createdAt: now,
      updatedAt: now,
    },
    transactionIds: [transaction.id],
    decision: 'pending',
    reasons: [
      'Описание операции соответствует известной подписке «' +
        service.name +
        '».',
      'В истории пока недостаточно платежей, чтобы подтвердить повторяемость.',
      'Ежемесячный период и следующая дата — предварительное предположение. Перед подтверждением их можно изменить.',
      'Сумма взята из банковской операции.',
    ],
  };
}
