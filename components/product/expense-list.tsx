'use client';
import { useState } from 'react';
import { ServiceLogo } from './service-logo';
import { advanceTo, today } from '@/lib/domain/calendar';
import { Search, ArrowUpRight, Repeat2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SelectField } from './select-field';
import {
  type RecurringExpense,
  typeLabels,
  periodLabels,
  statusLabels,
  requiredTypes,
  expenseTypes,
} from '@/lib/domain/types';
import { money } from '@/lib/domain/money';
export function ExpenseList({ expenses }: { expenses: RecurringExpense[] }) {
  const [search, setSearch] = useState(''),
    [tab, setTab] = useState('all'),
    [status, setStatus] = useState('all'),
    [sort, setSort] = useState('date'),
    [type, setType] = useState('all');
  const filtered = expenses
    .map((e) => ({
      ...e,
      nextPaymentAt:
        e.nextPaymentAt && e.status === 'active'
          ? advanceTo(
              e.nextPaymentAt,
              e.billingPeriod,
              today(),
              e.anchorDay,
              e.customDays,
            )
          : e.nextPaymentAt,
    }))
    .filter(
      (e) =>
        (!search || e.name.toLowerCase().includes(search.toLowerCase())) &&
        (type === 'all' || e.type === type) &&
        (status === 'all' || e.status === status) &&
        (tab === 'all' ||
          (tab === 'subscriptions'
            ? e.type === 'subscription'
            : tab === 'required'
              ? requiredTypes.includes(e.type)
              : e.type !== 'subscription' && !requiredTypes.includes(e.type))),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'ru')
        : sort === 'amount'
          ? a.currency.localeCompare(b.currency) ||
            b.amountMinor - a.amountMinor
          : (a.nextPaymentAt ?? '9999').localeCompare(
              b.nextPaymentAt ?? '9999',
            ),
    );
  return (
    <>
      <div className="list-toolbar">
        <div className="search-control">
          <Search size={17} />
          <Input
            aria-label="Поиск расходов"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти расход…"
          />
        </div>
        <SelectField
          label="Тип"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'Все типы' },
            ...expenseTypes.map((v) => ({ value: v, label: typeLabels[v] })),
          ]}
        />
        <SelectField
          label="Статус"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Все статусы' },
            ...Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <SelectField
          label="Сортировка"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'date', label: 'По дате' },
            { value: 'amount', label: 'По стоимости' },
            { value: 'name', label: 'По названию' },
          ]}
        />
      </div>
      <div className="list-tabs">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {[
              { value: 'all', label: 'Все' },
              { value: 'subscriptions', label: 'Подписки' },
              { value: 'required', label: 'Обязательные' },
              { value: 'other', label: 'Прочее' },
            ].map((t) => (
              <TabsTrigger value={t.value} key={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="muted">{filtered.length} расходов</span>
      </div>
      {!filtered.length ? (
        <div className="panel empty-state">
          <Repeat2 size={36} />
          <h2>
            {expenses.length
              ? 'Ничего не нашлось'
              : 'Здесь появятся ваши расходы'}
          </h2>
          <p>
            {expenses.length
              ? 'Попробуйте изменить фильтры или поисковый запрос.'
              : 'Загрузите выписку — Поток найдёт повторяющиеся платежи.'}
          </p>
          {!expenses.length && (
            <a href="/import" className="primary-button">
              Загрузить выписку
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="expense-cards">
            {filtered.map((e) => (
              <a
                className="panel expense-mobile"
                href={'/expenses/' + e.id}
                key={e.id}
              >
                <div className="expense-name">
                  <ServiceLogo
                    name={e.name}
                    serviceId={e.serviceId}
                    type={e.type}
                  />
                  <span>
                    <strong>{e.name}</strong>
                    <small>{typeLabels[e.type]}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </div>
                <div>
                  <span className="amount-cell">
                    {money(e.amountMinor, e.currency)}
                  </span>
                  <span className={'status ' + e.status}>
                    {statusLabels[e.status]}
                  </span>
                </div>
                <p>
                  {periodLabels[e.billingPeriod]} ·{' '}
                  {e.status === 'active' && e.nextPaymentAt
                    ? 'Ожидается ≈ ' + e.nextPaymentAt
                    : 'Без прогноза'}
                </p>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
