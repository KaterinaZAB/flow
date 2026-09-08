import { analytics } from '../domain/analytics';
import {
  recommendations,
  potentialSavingsPerMonth,
} from '../domain/recommendations';
import type { RecurringExpense, Transaction } from '../domain/types';
import { today } from '../domain/calendar';

export function projectDashboard(
  expenses: RecurringExpense[],
  transactions: Transaction[],
  asOf = today(),
) {
  const items = recommendations(expenses, transactions);
  const currencies = [...new Set(['RUB', ...expenses.map((e) => e.currency)])];
  return {
    asOf,
    recommendations: items,
    currencies,
    byCurrency: Object.fromEntries(
      currencies.map((currency) => [
        currency,
        {
          ...analytics(expenses, currency, asOf),
          potentialSavings: potentialSavingsPerMonth(items, currency),
        },
      ]),
    ),
  };
}
export type DashboardProjection = ReturnType<typeof projectDashboard>;
