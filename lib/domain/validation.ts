import { serviceById } from './catalog.ts';
import {
  currencies,
  expenseTypes,
  periods,
  statuses,
  type RecurringExpense,
} from './types.ts';
import { parseMinor } from './money.ts';
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === value &&
    value >= '2000-01-01' &&
    value <= '2100-12-31'
  );
}
export function validateExpense(
  input: unknown,
): Pick<
  RecurringExpense,
  | 'name'
  | 'type'
  | 'amountMinor'
  | 'currency'
  | 'billingPeriod'
  | 'customDays'
  | 'nextPaymentAt'
  | 'anchorDay'
  | 'status'
  | 'serviceId'
> {
  if (!input || typeof input !== 'object')
    throw new Error('Заполните форму расхода.');
  const x = input as Record<string, unknown>;
  const name = typeof x.name === 'string' ? x.name.trim() : '';
  // Reject non-printing characters in names.
  // oxlint-disable-next-line no-control-regex
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001f]/.test(name))
    throw new Error('Название: от 2 до 120 символов.');
  if (!expenseTypes.includes(x.type as never))
    throw new Error('Выберите тип расхода.');
  if (!currencies.includes(x.currency as never))
    throw new Error('Выберите поддерживаемую валюту.');
  if (!periods.includes(x.billingPeriod as never))
    throw new Error('Выберите периодичность.');
  if (!statuses.includes(x.status as never))
    throw new Error('Некорректный статус.');
  const amountMinor = parseMinor(typeof x.amount === 'string' || typeof x.amount === 'number' ? String(x.amount) : '');
  if (amountMinor <= 0) throw new Error('Стоимость должна быть больше нуля.');
  const nextPaymentAt =
    x.nextPaymentAt === '' || x.nextPaymentAt == null ? null : x.nextPaymentAt;
  if (nextPaymentAt !== null && !validDate(nextPaymentAt))
    throw new Error('Укажите корректную дату.');
  const customDays = x.billingPeriod === 'custom' ? Number(x.customDays) : null;
  if (
    customDays !== null &&
    (!Number.isInteger(customDays) || customDays < 1 || customDays > 366)
  )
    throw new Error('Свой период: от 1 до 366 дней.');
  const serviceId =
    typeof x.serviceId === 'string' && x.serviceId ? x.serviceId : null;
  if (serviceId && !serviceById(serviceId))
    throw new Error('Выберите сервис из каталога.');
  return {
    name,
    type: x.type as RecurringExpense['type'],
    amountMinor,
    currency: x.currency as string,
    billingPeriod: x.billingPeriod as RecurringExpense['billingPeriod'],
    status: x.status as RecurringExpense['status'],
    nextPaymentAt: nextPaymentAt as string | null,
    anchorDay: nextPaymentAt ? Number(String(nextPaymentAt).slice(8)) : null,
    customDays,
    serviceId,
  };
}
