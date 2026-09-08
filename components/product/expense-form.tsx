'use client';
import { localCommand } from '@/lib/local/actions';
import { useState, type SyntheticEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectField } from './select-field';
import {
  expenseTypes,
  typeLabels,
  periods,
  periodLabels,
  currencies,
  statuses,
  statusLabels,
  type RecurringExpense,
} from '@/lib/domain/types';
import { services } from '@/lib/domain/catalog';
import { Plus, PenLine } from 'lucide-react';
export function ExpenseForm({
  expense,
  onSave,
  buttonLabel,
  iconOnly = false,
  guest = false,
}: {
  expense?: RecurringExpense;
  onSave?: (data: Record<string, unknown>) => Promise<void>;
  buttonLabel?: string;
  iconOnly?: boolean;
  guest?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const initial = () => ({
    name: expense?.name ?? '',
    type: expense?.type ?? 'subscription',
    amount: expense ? String(expense.amountMinor / 100) : '',
    currency: expense?.currency ?? 'RUB',
    billingPeriod: expense?.billingPeriod ?? 'monthly',
    customDays: String(expense?.customDays ?? 30),
    nextPaymentAt: expense?.nextPaymentAt ?? '',
    status: expense?.status ?? 'active',
    serviceId: expense?.serviceId ?? '',
  });
  const [form, setForm] = useState(initial);
  const field = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  async function submit(ev: SyntheticEvent<HTMLFormElement>) {
    ev.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (onSave) await onSave(form);
      else {
        const r = await localCommand(
          '/expenses' + (expense ? '/' + expense.id : ''),
          {
            method: expense ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          },
        );
        const data = (await r.json()) as {
          error?: string;
          id: string;
        };
        if (!r.ok) throw new Error(data.error);
        window.location.href = '/expenses/' + data.id;
      }
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (guest)
    return (
      <button className="secondary-button" disabled>
        Пример · добавление доступно в вашем списке
      </button>
    );
  return (
    <>
      <button
        className={expense ? 'secondary-button' : 'primary-button'}
        aria-label={iconOnly ? 'Добавить расход' : undefined}
        onClick={() => {
          setForm(initial());
          setError('');
          setOpen(true);
        }}
      >
        {expense ? <PenLine size={16} /> : <Plus size={17} />}{' '}
        <span className="button-label">
          {buttonLabel ?? (expense ? 'Редактировать' : 'Добавить расход')}
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] p-7 max-h-[90dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {expense ? 'Редактировать расход' : 'Новый регулярный расход'}
            </DialogTitle>
            <DialogDescription>
              Добавьте то, что ещё не нашлось в выписке.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="form-field full">
                <label htmlFor="expense-service">
                  Известный сервис (необязательно)
                </label>
                <SelectField
                  id="expense-service"
                  label="Сервис"
                  value={form.serviceId}
                  onChange={(v) => {
                    const service = services.find((s) => s.id === v);
                    setForm((s) => ({
                      ...s,
                      serviceId: v,
                      ...(service
                        ? {
                            name: s.name || service.name,
                            type: service.category,
                          }
                        : {}),
                    }));
                  }}
                  options={[
                    { value: '', label: 'Свой расход' },
                    ...services.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </div>
              <label className="form-field full">
                Название
                <Input
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => field('name', e.target.value)}
                  placeholder="Например, домашний интернет"
                />
              </label>
              <div className="form-field">
                <label htmlFor="expense-type">Тип</label>
                <SelectField
                  id="expense-type"
                  label="Тип расхода"
                  value={form.type}
                  onChange={(v) => field('type', v)}
                  options={expenseTypes.map((v) => ({
                    value: v,
                    label: typeLabels[v],
                  }))}
                />
              </div>
              <div className="form-field">
                <label htmlFor="expense-period">Периодичность</label>
                <SelectField
                  id="expense-period"
                  label="Периодичность"
                  value={form.billingPeriod}
                  onChange={(v) => field('billingPeriod', v)}
                  options={periods.map((v) => ({
                    value: v,
                    label: periodLabels[v],
                  }))}
                />
              </div>
              <label className="form-field">
                Стоимость
                <Input
                  required
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => field('amount', e.target.value)}
                  placeholder="0,00"
                />
              </label>
              <div className="form-field">
                <label htmlFor="expense-currency">Валюта</label>
                <SelectField
                  id="expense-currency"
                  label="Валюта"
                  value={form.currency}
                  onChange={(v) => field('currency', v)}
                  options={currencies.map((v) => ({ value: v, label: v }))}
                />
              </div>
              {form.billingPeriod === 'custom' && (
                <label className="form-field full">
                  Интервал в днях
                  <Input
                    type="number"
                    required
                    min={1}
                    max={366}
                    value={form.customDays}
                    onChange={(e) => field('customDays', e.target.value)}
                  />
                </label>
              )}
              <label className="form-field full">
                Следующее ожидаемое списание
                <Input
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={form.nextPaymentAt}
                  onChange={(e) => field('nextPaymentAt', e.target.value)}
                />
                <small>Можно оставить пустым, если дата неизвестна.</small>
              </label>
              {expense && (
                <div className="form-field full">
                  <label htmlFor="expense-status">Статус</label>
                  <SelectField
                    id="expense-status"
                    label="Статус"
                    value={form.status}
                    onChange={(v) => field('status', v)}
                    options={statuses.map((v) => ({
                      value: v,
                      label: statusLabels[v],
                    }))}
                  />
                  <small>Статус меняет только учёт в Потоке.</small>
                </div>
              )}
            </div>
            {error && (
              <p role="alert" className="error-box">
                {error}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Назад
              </button>
              <button disabled={busy} className="primary-button" type="submit">
                {busy
                  ? 'Сохраняем…'
                  : expense
                    ? 'Сохранить'
                    : 'Добавить расход'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
