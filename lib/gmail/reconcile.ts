import type { ParsedReceipt } from './types.ts';
import type { Transaction, RecurringExpense } from '../domain/types.ts';
import { normalizeMerchant } from '../domain/catalog.ts';
import { daysBetween } from '../domain/calendar.ts';
export const receiptKey = (receipt: ParsedReceipt) =>
  (receipt.serviceId
    ? 'service:' + receipt.serviceId
    : receipt.merchant
      ? normalizeMerchant(receipt.merchant)
      : 'sender:' + receipt.sender) +
  '|' +
  (receipt.currency ?? 'unknown');
export function matchingBankTransaction(
  receipt: ParsedReceipt,
  transactions: Transaction[],
) {
  if (
    !['paid', 'renewed'].includes(receipt.status) ||
    !receipt.amountMinor ||
    !receipt.currency ||
    !receipt.paymentDate
  )
    return null;
  const merchant = receipt.serviceId
    ? 'service:' + receipt.serviceId
    : receipt.merchant
      ? normalizeMerchant(receipt.merchant)
      : null;
  if (!merchant) return null;
  const matches = transactions.filter(
    (t) =>
      t.currency === receipt.currency &&
      t.amountMinor === receipt.amountMinor &&
      t.normalizedMerchant === merchant &&
      Math.abs(daysBetween(t.paidAt, receipt.paymentDate!)) <= 2,
  );
  return matches.length === 1 ? matches[0] : null;
}
export function matchingExpense(
  receipt: ParsedReceipt,
  expenses: RecurringExpense[],
) {
  const matches = expenses.filter(
    (e) =>
      (receipt.serviceId
        ? e.serviceId === receipt.serviceId
        : !!receipt.merchant &&
          normalizeMerchant(e.name) === normalizeMerchant(receipt.merchant)) &&
      (!receipt.currency || e.currency === receipt.currency),
  );
  return matches.length === 1 ? matches[0] : null;
}
export function freshProviderDate(receipt: ParsedReceipt, asOf: string) {
  return (
    receipt.knownSender &&
    receipt.confidence >= 0.7 &&
    !!receipt.nextPaymentAt &&
    receipt.nextPaymentAt >= asOf &&
    daysBetween(receipt.receivedAt.slice(0, 10), asOf) <= 90
  );
}
