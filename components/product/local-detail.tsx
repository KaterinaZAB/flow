'use client';

import { DeleteAction } from '@/components/product/delete-action';
import type { Workspace } from '@/lib/local/schema';

import { ExpenseForm } from '@/components/product/expense-form';
import { ServiceLogo } from '@/components/product/service-logo';
import { Cancellation } from '@/components/product/cancellation';
import { RecommendationCard } from '@/components/product/recommendations';
import { money } from '@/lib/domain/money';
import { typeLabels, periodLabels, statusLabels } from '@/lib/domain/types';
import { monthlyEquivalent, yearlyEquivalent } from '@/lib/domain/analytics';
import { advanceTo, today, dateLabel } from '@/lib/domain/calendar';
import { serviceById } from '@/lib/domain/catalog';
import { cancellationStrategy } from '@/lib/domain/cancellation';
import { recommendations } from '@/lib/domain/recommendations';
import { ArrowLeft, History, CheckCircle2 } from 'lucide-react';
export function LocalDetail({ id, state }: { id: string; state: Workspace }) {
  const expense = state.expenses.find((e) => e.id === id);
  if (!expense)
    return (
      <div className="panel empty-state">
        <h1>Расход не найден</h1>
        <a href="/expenses">К расходам</a>
      </div>
    );
  const allHistory = state.transactions,
    expenses = state.expenses;
  const history = allHistory.filter((t) => t.recurringExpenseId === id);
  const relevant = recommendations(expenses, allHistory).filter((r) =>
    r.relatedExpenseIds.includes(id),
  );
  const service = serviceById(expense.serviceId);
  const next = expense.nextPaymentAt
    ? advanceTo(
        expense.nextPaymentAt,
        expense.billingPeriod,
        today(),
        expense.anchorDay,
        expense.customDays,
      )
    : null;
  return (
    <>
      <a href="/expenses" className="back-link">
        <ArrowLeft size={17} />К расходам
      </a>
      <div className="detail-hero panel">
        <div className="detail-title">
          <ServiceLogo
            name={expense.name}
            serviceId={expense.serviceId}
            type={expense.type}
            large
          />
          <div>
            <h1>{expense.name}</h1>
            <p>{service?.name ?? typeLabels[expense.type]}</p>
          </div>
          <span className={'status ' + expense.status}>
            {statusLabels[expense.status]}
          </span>
        </div>
        <div className="detail-cost">
          {money(expense.amountMinor, expense.currency)}
          <span>
            {periodLabels[expense.billingPeriod].toLowerCase()}
            {expense.billingPeriod === 'custom'
              ? ' · ' + expense.customDays + ' дн.'
              : ''}
          </span>
        </div>
        <p>
          Следующее ожидаемое списание:{' '}
          {expense.status === 'active'
            ? next
              ? 'примерно ' + dateLabel(next, true)
              : 'дата не указана'
            : 'не учитывается в прогнозе'}
        </p>
        <div className="page-actions">
          <a href="#manage" className="primary-button">
            Управлять расходом
          </a>
          <ExpenseForm expense={expense} />
        </div>
      </div>
      {expense.nextPaymentAtSource === 'provider_email' && (
        <p className="source-notice">
          Дата следующего списания указана в свежем подтверждённом письме
          сервиса.
        </p>
      )}
      <div className="detail-cost-grid">
        <div className="panel">
          <span>В месяц</span>
          <strong>{money(monthlyEquivalent(expense), expense.currency)}</strong>
          <small>Средняя регулярная нагрузка</small>
        </div>
        <div className="panel">
          <span>Годовой эквивалент</span>
          <strong>{money(yearlyEquivalent(expense), expense.currency)}</strong>
          <small>При сохранении текущей стоимости</small>
        </div>
      </div>
      <div className="detail-grid">
        <section className="panel detail-panel">
          <h2>
            История платежей <span className="muted">· {history.length}</span>
          </h2>
          {history.length ? (
            <div className="history-list">
              {history.slice(0, 60).map((t) => (
                <div key={t.id}>
                  <span>{dateLabel(t.paidAt, true)}</span>
                  <strong>{money(t.amountMinor, t.currency)}</strong>
                </div>
              ))}
              {history.length > 60 && <p>Показаны 60 последних операций.</p>}
            </div>
          ) : (
            <div className="empty-state">
              <History size={26} />
              <p>История появится после импорта выписки.</p>
            </div>
          )}
        </section>
        <div className="detail-side">
          <section className="panel detail-panel">
            <h2>Детали расхода</h2>
            <dl className="detail-dl">
              <div>
                <dt>Категория</dt>
                <dd>{typeLabels[expense.type]}</dd>
              </div>
              <div>
                <dt>Период</dt>
                <dd>{periodLabels[expense.billingPeriod]}</dd>
              </div>
              <div>
                <dt>Источник</dt>
                <dd>
                  {expense.source === 'gmail'
                    ? 'Gmail'
                    : expense.source === 'manual'
                      ? 'Добавлен вручную'
                      : 'Банковская выписка'}
                </dd>
              </div>
              {expense.confidence !== null && (
                <div>
                  <dt>Уверенность алгоритма</dt>
                  <dd>{Math.round(expense.confidence * 100)}%</dd>
                </div>
              )}
            </dl>
            {expense.source !== 'manual' && (
              <p className="detail-explanation">
                Найдено {history.length} похожих операций. Дата и сумма —
                прогноз по истории; вы можете их исправить.
              </p>
            )}
          </section>
          {relevant.length ? (
            relevant
              .slice(0, 2)
              .map((r) => <RecommendationCard key={r.id} item={r} />)
          ) : history.length >= 3 ? (
            <section className="panel stable-note">
              <CheckCircle2 size={20} />
              <p>
                В последних платежах не найдено значительного роста стоимости.
              </p>
            </section>
          ) : null}
        </div>
      </div>

      <div id="manage">
        <Cancellation
          expense={expense}
          strategy={cancellationStrategy(service)}
        />
        <div className="expense-delete-section">
          <p>
            Удаление убирает запись из списка. Чтобы сохранить её историю после
            отмены услуги, используйте «Я отменил подписку».
          </p>
          <DeleteAction expenseId={id} />
        </div>
      </div>
    </>
  );
}
