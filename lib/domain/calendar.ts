import type { BillingPeriod } from './types.ts';
const dayMs = 86400000;
export const today = () => new Date().toISOString().slice(0, 10);
export function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / dayMs,
  );
}
export function monthEnd(date: string) {
  const d = new Date(date + 'T00:00:00Z');
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
}
export function addPeriod(
  date: string,
  period: BillingPeriod,
  steps = 1,
  anchorDay?: number | null,
  customDays?: number | null,
) {
  const d = new Date(date + 'T00:00:00Z');
  if (period === 'weekly' || period === 'custom') {
    d.setUTCDate(
      d.getUTCDate() + steps * (period === 'weekly' ? 7 : (customDays ?? 30)),
    );
    return d.toISOString().slice(0, 10);
  }
  const months =
    steps * (period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12);
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(
    Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0),
  ).getUTCDate();
  m.setUTCDate(Math.min(anchorDay ?? d.getUTCDate(), last));
  return m.toISOString().slice(0, 10);
}
export function advanceTo(
  date: string,
  period: BillingPeriod,
  asOf: string,
  anchorDay?: number | null,
  customDays?: number | null,
) {
  let current = date;
  let count = 0;
  while (current < asOf && count++ < 40000)
    current = addPeriod(current, period, 1, anchorDay, customDays);
  return current;
}
export function dateLabel(date: string, year = false) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(year ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(date + 'T00:00:00Z'));
}
