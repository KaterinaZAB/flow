export const expenseTypes = [
  'subscription',
  'utility',
  'internet',
  'mobile',
  'rent',
  'insurance',
  'loan',
  'service',
  'software',
  'cloud',
  'other',
] as const;
export type RecurringExpenseType = (typeof expenseTypes)[number];
export const periods = [
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
] as const;
export type BillingPeriod = (typeof periods)[number];
export const statuses = ['active', 'paused', 'cancelled'] as const;
export type RecurringExpenseStatus = (typeof statuses)[number];
export const currencies = [
  'RUB',
  'USD',
  'EUR',
  'GBP',
  'KZT',
  'BYN',
  'GEL',
  'TRY',
] as const;
/** All monetary amounts are integer minor units (kopecks/cents). */
export type ExpenseSource = 'manual' | 'bank-import' | 'gmail';
export type ExpenseEvidence = {
  id: string;
  expenseId: string | null;
  source: 'bank_transaction' | 'gmail_receipt';
  sourceId: string;
  confidence: number;
};
export type RecurringExpense = {
  id: string;
  name: string;
  type: RecurringExpenseType;
  amountMinor: number;
  currency: string;
  billingPeriod: BillingPeriod;
  customDays: number | null;
  nextPaymentAt: string | null;
  anchorDay: number | null;
  status: RecurringExpenseStatus;
  serviceId: string | null;
  source: ExpenseSource | 'detected';
  nextPaymentAtSource?: 'provider_email' | 'transaction_prediction' | 'manual';
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
};
export type Transaction = {
  id: string;
  originalMerchant: string;
  normalizedMerchant: string;
  amountMinor: number;
  currency: string;
  paidAt: string;
  recurringExpenseId: string | null;
  sourceImportId: string;
  fingerprint: string;
  occurrence: number;
};
export type TransactionImport = {
  id: string;
  filename: string;
  format: 'csv' | 'xlsx' | 'pdf';
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  transactionCount: number;
  skippedCount: number;
  error: string | null;
};
export type Candidate = {
  id: string;
  importId: string;
  expense: RecurringExpense;
  transactionIds: string[];
  reasons: string[];
  decision: 'pending' | 'confirmed' | 'rejected';
};
export type CancellationStrategy =
  | { type: 'external-url'; url: string }
  | { type: 'instructions'; steps: string[] }
  | { type: 'unsupported' };
export type ServiceEmailMatcher = {
  senderDomains?: string[];
  senderEmails?: string[];
  subjectPatterns?: string[];
};
export type Service = {
  id: string;
  name: string;
  category: RecurringExpenseType;
  group?: string;
  merchantAliases: string[];
  emailMatchers?: ServiceEmailMatcher;
  website?: string;
  manageSubscriptionUrl?: string;
  cancellationUrl?: string;
  cancellationInstructions?: string[];
  color: string;
  monogram: string;
};
export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  estimatedSaving: number;
  currency: string;
  severity: 'info' | 'warning';
  relatedExpenseIds: string[];
  action: string;
  kind: 'increase' | 'overlap' | 'anomaly' | 'annual';
};
export const typeLabels: Record<RecurringExpenseType, string> = {
  subscription: 'Подписка',
  utility: 'ЖКХ',
  internet: 'Интернет',
  mobile: 'Мобильная связь',
  rent: 'Аренда',
  insurance: 'Страховка',
  loan: 'Кредит',
  service: 'Услуги',
  software: 'Софт',
  cloud: 'Облако',
  other: 'Прочее',
};
export const periodLabels: Record<BillingPeriod, string> = {
  weekly: 'Каждую неделю',
  monthly: 'Каждый месяц',
  quarterly: 'Раз в квартал',
  yearly: 'Каждый год',
  custom: 'Свой период',
};
export const statusLabels: Record<RecurringExpenseStatus, string> = {
  active: 'Активен',
  paused: 'На паузе',
  cancelled: 'Отменён',
};
export const requiredTypes: RecurringExpenseType[] = [
  'utility',
  'internet',
  'mobile',
  'rent',
  'insurance',
  'loan',
];
