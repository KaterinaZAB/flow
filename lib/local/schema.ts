import { z } from 'zod';
import {
  expenseTypes,
  periods,
  statuses,
  currencies,
} from '../domain/types.ts';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const id = z.string().uuid();
const serviceId = z.string().regex(/^[a-z0-9-]{1,100}$/);
const expense = z
  .object({
    id,
    name: z.string().min(2).max(120),
    type: z.enum(expenseTypes),
    amountMinor: minor,
    currency: z.string().refine((v) => currencies.includes(v as never)),
    billingPeriod: z.enum(periods),
    customDays: z.number().int().min(1).max(366).nullable(),
    nextPaymentAt: date.nullable(),
    anchorDay: z.number().int().min(1).max(31).nullable(),
    status: z.enum(statuses),
    serviceId: serviceId.nullable(),
    source: z.enum(['manual', 'bank-import', 'gmail', 'detected']),
    nextPaymentAtSource: z
      .enum(['manual', 'provider_email', 'transaction_prediction'])
      .optional(),
    recurringConfidence: z.number().min(0).max(1).optional(),
    subscriptionConfidence: z.number().min(0).max(1).optional(),
    periodConfidence: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
const transaction = z
  .object({
    id,
    originalMerchant: z.string().max(240),
    bankCategory: z.string().max(120).optional(),
    transactionTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
      .optional(),
    processedAt: date.optional(),
    authorizationCode: z
      .string()
      .regex(/^\d{5,6}$/)
      .optional(),
    rawDescription: z.string().max(1000).optional(),
    serviceMatchConfidence: z.number().min(0).max(1).optional(),
    transactionConfidence: z.number().min(0).max(1).optional(),
    parseConfidence: z.number().min(0).max(1).optional(),
    parseReviewReasons: z.array(z.string().max(80)).max(10).optional(),
    normalizedMerchant: z.string().max(240),
    amountMinor: minor,
    currency: z.string().refine((v) => currencies.includes(v as never)),
    paidAt: date,
    recurringExpenseId: id.nullable(),
    sourceImportId: id,
    fingerprint: z.string().max(128),
    occurrence: z.number().int().nonnegative(),
  })
  .strict();
export const workspaceV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    started: z.boolean(),
    expenses: z.array(expense).max(10000),
    transactions: z.array(transaction).max(100000),
    imports: z
      .array(
        z
          .object({
            id,
            filename: z.string().max(256),
            format: z.enum(['csv', 'xlsx', 'pdf']),
            status: z.enum(['processing', 'completed', 'failed']),
            createdAt: z.string().datetime(),
            transactionCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
            error: z.string().nullable(),
          })
          .strict(),
      )
      .max(10000),
    candidates: z
      .array(
        z
          .object({
            id,
            importId: id,
            expense,
            transactionIds: z.array(id),
            reasons: z.array(z.string().max(1000)),
            decision: z.enum(['pending', 'confirmed', 'rejected']),
          })
          .strict(),
      )
      .max(10000),
    settings: z.object({ baseCurrency: z.enum(currencies) }).strict(),
  })
  .strict();
export const workspaceSchema = workspaceV1Schema.extend({
  schemaVersion: z.literal(2),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const emptyWorkspace = (): Workspace => ({
  schemaVersion: 2,
  revision: 0,
  started: false,
  expenses: [],
  transactions: [],
  imports: [],
  candidates: [],
  settings: { baseCurrency: 'RUB' },
});
