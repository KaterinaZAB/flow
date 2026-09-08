import type { Candidate, RecurringExpense, Transaction } from '@/lib/domain/types';

const now = '2026-09-01T00:00:00.000Z';
const rows = [
  ['demo-rent', 'Аренда квартиры', 'rent', 18000, '2026-09-10', null],
  ['demo-utilities', 'ЖКХ', 'utility', 5200, '2026-09-12', null],
  ['demo-internet', 'Домашний интернет', 'internet', 790, '2026-09-08', null],
  ['demo-mobile', 'Мобильная связь', 'mobile', 650, '2026-09-14', null],
  ['demo-yandex', 'Яндекс Плюс', 'subscription', 399, '2026-09-09', 'yandex-plus'],
  ['demo-chatgpt', 'ChatGPT Plus', 'software', 1999, '2026-09-21', 'openai'],
  ['demo-netflix', 'Netflix', 'subscription', 899, '2026-09-18', 'netflix'],
  ['demo-spotify', 'Spotify', 'subscription', 299, '2026-09-23', 'spotify'],
  ['demo-icloud', 'iCloud+', 'cloud', 149, '2026-09-25', 'icloud'],
  ['demo-adobe', 'Adobe Photography', 'software', 999, '2026-09-27', 'adobe'],
  ['demo-insurance', 'Страхование', 'insurance', 1200, '2026-09-29', null],
  ['demo-gym', 'Фитнес-клуб', 'service', 3590, '2026-09-16', null],
  ['demo-cinema', 'Онлайн-кинотеатр', 'subscription', 399, '2026-09-20', null],
  ['demo-storage', 'Облачное хранилище', 'cloud', 207, '2026-09-30', null],
] as const;

export const demoExpenses: RecurringExpense[] = rows.map(([id, name, type, amount, next, serviceId]) => ({
  id, name, type, amountMinor: amount * 100, currency: 'RUB', billingPeriod: 'monthly',
  customDays: null, nextPaymentAt: next, anchorDay: Number(next.slice(-2)), status: 'active',
  serviceId, source: id === 'demo-chatgpt' ? 'gmail' : 'bank-import',
  nextPaymentAtSource: id === 'demo-chatgpt' ? 'provider_email' : 'transaction_prediction',
  confidence: 0.91, createdAt: now, updatedAt: now,
}));

export const demoTransactions: Transaction[] = demoExpenses.flatMap((expense) =>
  [0, 1, 2].map((offset) => {
    const month = String(8 - offset).padStart(2, '0');
    const paidAt = `2026-${month}-${String(expense.anchorDay ?? 10).padStart(2, '0')}`;
    return { id: `${expense.id}-tx-${offset}`, originalMerchant: expense.name,
      normalizedMerchant: expense.name.toLowerCase(), amountMinor: expense.amountMinor,
      currency: expense.currency, paidAt, recurringExpenseId: expense.id,
      sourceImportId: 'demo-import', fingerprint: `${expense.id}-${paidAt}`, occurrence: 0 };
  }),
);

export const demoCandidates: Candidate[] = demoExpenses.slice(4, 7).map((expense) => ({
  id: `candidate-${expense.id}`, importId: 'demo-import', expense: { ...expense, id: `candidate-${expense.id}`, source: 'detected' },
  transactionIds: demoTransactions.filter((t) => t.recurringExpenseId === expense.id).map((t) => t.id),
  reasons: ['Похожие списания повторяются каждый месяц', 'Сумма платежа стабильна', 'Получатель совпал с известным сервисом'],
  decision: 'pending',
}));
