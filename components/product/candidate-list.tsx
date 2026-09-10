'use client';
import { localCommand } from '@/lib/local/actions';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ArrowRight, X, ScanLine, CheckCircle2 } from 'lucide-react';
import type { Candidate, Transaction } from '@/lib/domain/types';
import { periodLabels } from '@/lib/domain/types';
import { money } from '@/lib/domain/money';
import { dateLabel } from '@/lib/domain/calendar';
import { ExpenseForm } from './expense-form';
import { ServiceLogo } from './service-logo';
export function CandidateList({
  initial,
  transactions,
  guest = false,
}: {
  initial: Candidate[];
  transactions: Transaction[];
  guest?: boolean;
}) {
  const [items, setItems] = useState(initial),
    [selected, setSelected] = useState<Set<string>>(
      () =>
        new Set(
          initial
            .filter((c) => (c.expense.confidence ?? 0) >= 0.8)
            .map((c) => c.id),
        ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [finished, setFinished] = useState(false);
  async function action(
    ids: string[],
    decision: string,
    edit?: Record<string, unknown>,
  ) {
    setBusy(true);
    setError('');
    try {
      const r = await localCommand('/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, decision, edit }),
      });
      const result = (await r.json()) as {
        error?: string;
      };
      if (!r.ok) throw new Error(result.error);
      const updated = await localCommand('/candidates', {
        cache: 'no-store',
      });
      if (!updated.ok) throw new Error('Не удалось обновить результат.');
      const data = (await updated.json()) as Candidate[];
      setItems(data);
      setSelected(
        (prev) =>
          new Set([...prev].filter((id) => data.some((c) => c.id === id))),
      );
      if (!data.length) setFinished(true);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const act = (ids: string[], decision: string) =>
    void action(ids, decision).catch(() => {});
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">РЕЗУЛЬТАТ АНАЛИЗА</div>
          <h1>
            {items.length
              ? 'Мы нашли ' + items.length + ' регулярных расходов'
              : finished
                ? 'Ваш обзор готов'
                : 'Все найденные расходы проверены'}
          </h1>
          <p>
            {items.length
              ? 'Проверьте результат. Вы всегда можете изменить или отклонить найденный расход.'
              : 'Можно открыть обзор или добавить ещё одну выписку.'}
          </p>
        </div>
        <span className="pill">
          <ScanLine size={15} /> Автоматический поиск
        </span>
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {!items.length ? (
        <div className="panel empty-state">
          <CheckCircle2 size={45} />
          <h2>
            {finished
              ? 'Теперь всё в одном месте'
              : 'Нет расходов, ожидающих подтверждения'}
          </h2>
          <p>
            {finished
              ? 'Подтверждённые расходы уже учтены в прогнозе.'
              : 'Выписка за один месяц тоже анализируется. Если подходящих платежей не нашлось, добавьте расход вручную или загрузите другую выписку.'}
          </p>
          <div className="empty-actions">
            <a className="primary-button" href="/">
              Перейти к обзору
              <ArrowRight size={16} />
            </a>
            <a className="secondary-button" href="/import">
              Импортировать выписку
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="selection-bar">
            <label>
              <Checkbox
                checked={selected.size === items.length}
                onCheckedChange={(checked) =>
                  setSelected(new Set(checked ? items.map((c) => c.id) : []))
                }
                aria-label="Выбрать все расходы"
              />
              Выбрать все
            </label>
            <span>
              {selected.size} из {items.length} выбрано
            </span>
          </div>
          <div className="candidate-grid">
            {items.map((c) => {
              const e = c.expense;
              const history = transactions
                .filter((t) => c.transactionIds.includes(t.id))
                .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
              return (
                <section
                  className={
                    'panel candidate ' + (selected.has(c.id) ? 'selected' : '')
                  }
                  key={c.id}
                >
                  <div className="candidate-top">
                    <Checkbox
                      aria-label={'Выбрать ' + e.name}
                      checked={selected.has(c.id)}
                      onCheckedChange={(value) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (value) next.add(c.id);
                          else next.delete(c.id);
                          return next;
                        })
                      }
                    />
                    <ServiceLogo
                      name={e.name}
                      serviceId={e.serviceId}
                      type={e.type}
                    />
                    <div>
                      <h3>{e.name}</h3>
                      <p>
                        {history.length === 1 && e.billingPeriod === 'monthly'
                          ? 'Предположительно ежемесячно'
                          : (history.length === 1
                              ? 'Предположительно · '
                              : '') + periodLabels[e.billingPeriod]}
                      </p>
                    </div>
                    <span
                      className={
                        'confidence ' +
                        ((e.confidence ?? 0) >= 0.8 ? 'high' : 'medium')
                      }
                    >
                      {Math.round((e.confidence ?? 0) * 100)}% ·{' '}
                      {(e.confidence ?? 0) >= 0.8
                        ? 'высокая'
                        : (e.confidence ?? 0) >= 0.5
                          ? 'средняя'
                          : 'низкая'}
                    </span>
                  </div>
                  <div className="candidate-amount">
                    {money(e.amountMinor, e.currency)}
                    <span>за платёж</span>
                  </div>
                  <p className="candidate-next">
                    {history.length === 1
                      ? 'При этом периоде — примерно '
                      : 'Ожидается примерно '}{' '}
                    {e.nextPaymentAt ? dateLabel(e.nextPaymentAt) : '—'}
                  </p>
                  <div className="candidate-history">
                    {history.length === 1 && (
                      <p className="import-hint">
                        Один платёж: повторяемость ещё не подтверждена.
                        Проверьте период и дату через «Изменить».
                      </p>
                    )}
                    <span>Последние платежи</span>
                    {history.slice(-3).map((t) => (
                      <div key={t.id}>
                        <span>{dateLabel(t.paidAt)}</span>
                        <strong>{money(t.amountMinor, t.currency)}</strong>
                      </div>
                    ))}
                  </div>
                  <details className="candidate-reasons">
                    <summary>Почему мы считаем расход регулярным</summary>
                    <ul>
                      {c.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                    <small>
                      Уверенность — оценка алгоритма, а не вероятность.
                    </small>
                  </details>
                  <div className="candidate-actions">
                    {
                      <button
                        disabled={busy}
                        className="primary-button"
                        onClick={() => act([c.id], 'confirmed')}
                      >
                        <Check size={15} />
                        Подтвердить
                      </button>
                    }
                    <ExpenseForm
                      expense={e}
                      buttonLabel="Изменить"
                      onSave={(data) => action([c.id], 'edit', data)}
                      guest={guest}
                    />
                    {
                      <button
                        disabled={busy}
                        className="reject-button"
                        onClick={() => act([c.id], 'rejected')}
                      >
                        <X size={15} />
                        Не регулярный
                      </button>
                    }
                  </div>
                </section>
              );
            })}
          </div>
          <div className="confirmation-bar">
            <div>
              <strong>Следующий шаг — ваш личный обзор</strong>
              <p>В расчёт попадут только подтверждённые расходы.</p>
            </div>
            {
              <button
                disabled={busy || !selected.size}
                className="primary-button"
                onClick={() => act([...selected], 'confirmed')}
              >
                {busy
                  ? 'Сохраняем…'
                  : 'Подтвердить выбранные (' + selected.size + ')'}
                <ArrowRight size={17} />
              </button>
            }
          </div>
        </>
      )}
    </>
  );
}
