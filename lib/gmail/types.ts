import { z } from 'zod';
import type { BillingPeriod } from '../domain/types.ts';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
  );
export const financialEventTypes = [
  'payment_receipt',
  'subscription_created',
  'subscription_renewed',
  'subscription_cancelled',
  'trial_started',
  'trial_ending',
  'price_changed',
  'upcoming_payment',
  'invoice',
  'irrelevant',
] as const;
export const parsedReceiptSchema = z
  .object({
    sourceMessageId: z.string().min(1).max(200),
    serviceId: z.string().max(100).nullable(),
    serviceName: z.string().max(120).nullable(),
    sender: z.string().max(250),
    merchant: z.string().max(240).nullable(),
    planName: z.string().max(120).nullable(),
    amountMinor: z.number().int().positive().max(100_000_000_000).nullable(),
    currency: z
      .enum(['RUB', 'USD', 'EUR', 'GBP', 'KZT', 'BYN', 'GEL', 'TRY'])
      .nullable(),
    paymentDate: date.nullable(),
    billingPeriod: z
      .enum(['weekly', 'monthly', 'quarterly', 'yearly'])
      .nullable(),
    nextPaymentAt: date.nullable(),
    trialEndsAt: date.nullable(),
    oldAmountMinor: z.number().int().positive().nullable(),
    newAmountMinor: z.number().int().positive().nullable(),
    effectiveAt: date.nullable(),
    status: z.enum(['paid', 'renewed', 'trial', 'cancelled', 'unknown']),
    classification: z.enum(financialEventTypes),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().max(300)).max(12),
    receivedAt: z.string().datetime(),
    knownSender: z.boolean(),
  })
  .strict();
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;
export type EmailFinancialEventType = (typeof financialEventTypes)[number];
export type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailPart;
};
export type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};
export type PreparedEmail = {
  id: string;
  sender: string;
  subject: string;
  text: string;
  receivedAt: string;
};
export type StoredReceipt = {
  id: string;
  messageId: string;
  receipt: ParsedReceipt;
  decision: string;
  expenseId: string | null;
  matchedTransactionId: string | null;
};
export type GmailDraft = {
  name: string;
  type: string;
  amount: string;
  currency: string;
  billingPeriod: BillingPeriod;
  nextPaymentAt: string;
  serviceId: string;
};
