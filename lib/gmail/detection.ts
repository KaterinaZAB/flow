import type { ParsedReceipt } from './types.ts';
import type { Transaction } from '../domain/types.ts';
import { normalizeMerchant } from '../domain/catalog.ts';
import { detectRecurring } from '../domain/detection.ts';
export function receiptPatterns(receipts: ParsedReceipt[], asOf: string) {
  const unique = new Map<string, ParsedReceipt>();
  for (const r of receipts) {
    if (
      !['paid', 'renewed'].includes(r.status) ||
      !r.paymentDate ||
      !r.amountMinor ||
      !r.currency ||
      (!r.serviceId && !r.merchant)
    )
      continue;
    const key = [
      r.serviceId ?? normalizeMerchant(r.merchant!),
      r.paymentDate,
      r.amountMinor,
      r.currency,
    ].join('|');
    if (!unique.has(key)) unique.set(key, r);
  }
  const transactions: Transaction[] = [...unique.entries()].map(
    ([fingerprint, r]) => ({
      id: r.sourceMessageId,
      sourceImportId: 'gmail',
      originalMerchant: r.serviceName ?? r.merchant!,
      normalizedMerchant: r.serviceId
        ? 'service:' + r.serviceId
        : normalizeMerchant(r.merchant!),
      amountMinor: r.amountMinor!,
      currency: r.currency!,
      paidAt: r.paymentDate!,
      recurringExpenseId: null,
      fingerprint,
      occurrence: 0,
    }),
  );
  return detectRecurring(transactions, 'gmail', asOf).filter(
    (c) => c.transactionIds.length > 1,
  );
}
