import { type RecurringExpense, requiredTypes, typeLabels } from './types.ts';
import { divideRounded } from './money.ts';
import { addPeriod, advanceTo, today, monthEnd } from './calendar.ts';
export function monthlyEquivalent(
  e: Pick<RecurringExpense, 'amountMinor' | 'billingPeriod' | 'customDays'>,
): number {
  switch (e.billingPeriod) {
    case 'monthly':
      return e.amountMinor;
    case 'quarterly':
      return divideRounded(e.amountMinor, 3);
    case 'yearly':
      return divideRounded(e.amountMinor, 12);
    case 'weekly':
      return divideRounded(e.amountMinor * 52, 12);
    case 'custom':
      return divideRounded(e.amountMinor * 365, (e.customDays ?? 30) * 12);
  }
}
export function yearlyEquivalent(
  e: Pick<RecurringExpense, 'amountMinor' | 'billingPeriod' | 'customDays'>,
) {
  switch (e.billingPeriod) {
    case 'monthly':
      return e.amountMinor * 12;
    case 'quarterly':
      return e.amountMinor * 4;
    case 'yearly':
      return e.amountMinor;
    case 'weekly':
      return e.amountMinor * 52;
    case 'custom':
      return divideRounded(e.amountMinor * 365, e.customDays ?? 30);
  }
}
export function upcomingPayments(
  expenses: RecurringExpense[],
  from: string,
  to: string,
) {
  const rows: {
    expense: RecurringExpense;
    date: string;
    amountMinor: number;
  }[] = [];
  for (const e of expenses) {
    if (e.status !== 'active' || !e.nextPaymentAt) continue;
    let date = advanceTo(
      e.nextPaymentAt,
      e.billingPeriod,
      from,
      e.anchorDay,
      e.customDays,
    );
    let i = 0;
    while (date <= to && i++ < 400) {
      rows.push({ expense: e, date, amountMinor: e.amountMinor });
      date = addPeriod(date, e.billingPeriod, 1, e.anchorDay, e.customDays);
    }
  }
  return rows.sort(
    (a, b) => a.date.localeCompare(b.date) || b.amountMinor - a.amountMinor,
  );
}
export function analytics(
  expenses: RecurringExpense[],
  currency: string,
  asOf = today(),
) {
  const active = expenses.filter(
    (e) => e.status === 'active' && e.currency === currency,
  );
  const monthly = active.reduce((n, e) => n + monthlyEquivalent(e), 0);
  const yearly = active.reduce((n, e) => n + yearlyEquivalent(e), 0);
  const subscriptions = active
    .filter((e) => ['subscription', 'software', 'cloud'].includes(e.type))
    .reduce((n, e) => n + monthlyEquivalent(e), 0);
  const required = active
    .filter((e) => requiredTypes.includes(e.type))
    .reduce((n, e) => n + monthlyEquivalent(e), 0);
  const end = asOf.slice(0, 8) + String(monthEnd(asOf)).padStart(2, '0');
  const endOfMonthPayments = upcomingPayments(active, asOf, end);
  const toMonthEnd = endOfMonthPayments.reduce((n, p) => n + p.amountMinor, 0);
  const categories = Object.entries(typeLabels)
    .map(([type, label]) => ({
      type,
      label,
      amount: active
        .filter((e) => e.type === type)
        .reduce((n, e) => n + monthlyEquivalent(e), 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const months = Array.from({ length: 6 }, (_, i) => {
    const start =
      i === 0 ? asOf : addPeriod(asOf.slice(0, 8) + '01', 'monthly', i, 1);
    const last = start.slice(0, 8) + String(monthEnd(start)).padStart(2, '0');
    return {
      month: start.slice(0, 7),
      label: new Date(start + 'T00:00:00Z')
        .toLocaleDateString('ru-RU', { month: 'short', timeZone: 'UTC' })
        .replace('.', ''),
      amount: upcomingPayments(active, start, last).reduce(
        (sum, p) => sum + p.amountMinor,
        0,
      ),
      partial: i === 0,
    };
  });
  return {
    activeCount: active.length,
    monthly,
    yearly,
    subscriptions,
    required,
    toMonthEnd,
    categories,
    months,
    missingDates: active.filter((e) => !e.nextPaymentAt).length,
    upcoming: upcomingPayments(
      active,
      asOf,
      addPeriod(asOf, 'monthly', 3),
    ).slice(0, 8),
  };
}
