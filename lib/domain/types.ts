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
  'bank_service',
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
/** gmail is a legacy persisted provenance value, not an available integration. */
export type ExpenseSource = 'manual' | 'bank-import' | 'gmail';
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
  /** Probability that the observed payments repeat on the inferred cadence. */
  recurringConfidence?: number;
  /** Probability that the merchant represents a subscription rather than another regular bill. */
  subscriptionConfidence?: number;
  /** Probability that the inferred billing period is correct. */
  periodConfidence?: number;
  /** Legacy persisted recurring confidence, retained for workspace compatibility. */
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
};
export type Transaction = {
  id: string;
  originalMerchant: string;
  bankCategory?: string;
  transactionTime?: string;
  processedAt?: string;
  authorizationCode?: string;
  rawDescription?: string;
  serviceMatchConfidence?: number;
  transactionConfidence?: number;
  parseConfidence?: number;
  parseReviewReasons?: string[];
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
export type Service = {
  id: string;
  name: string;
  category: RecurringExpenseType;
  group?: string;
  merchantAliases: string[];
  aliases?: MerchantAlias[];
  merchantClass?: MerchantBehaviorClass;
  website?: string;
  manageSubscriptionUrl?: string;
  cancellationUrl?: string;
  cancellationInstructions?: string[];
  color: string;
  monogram: string;
};
export type MerchantBehaviorClass =
  | 'subscription'
  | 'regular_bill'
  | 'bank_service'
  | 'usage_based'
  | 'retail'
  | 'transfer'
  | 'unknown';
export type MerchantAlias = {
  pattern: string;
  matchType: 'exact' | 'prefix' | 'contains' | 'regex';
  provenance:
    | 'observed-sber'
    | 'official-merchant-list'
    | 'user-example'
    | 'heuristic';
  confidence: number;
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
  bank_service: 'Банковские услуги',
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
