'use client';
import { ForecastChart } from './forecast-chart';
import { useState } from 'react';
import { SavingsBanner } from './recommendations';
import type { DashboardProjection } from '@/lib/domain/projections';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Repeat2,
  House,
  UploadCloud,
  ChevronRight,
  Info,
  Wallet,
  ChartNoAxesCombined,
} from 'lucide-react';
import { money } from '@/lib/domain/money';
import { dateLabel, daysBetween } from '@/lib/domain/calendar';
import { SelectField } from './select-field';
import { ExpenseForm } from './expense-form';
import { ServiceLogo } from './service-logo';
const colors = Array.from({ length: 7 }, (_, i) => `var(--chart-${i + 1})`);
export function Dashboard({
  projection,
  pending,
  guest = false,
}: {
  projection: DashboardProjection;
  pending: number;
  guest?: boolean;
}) {
  const options = projection.currencies;
  const [currency, setCurrency] = useState(options[0] ?? 'RUB');
  const data = projection.byCurrency[currency];
  const asOf = projection.asOf;
  const gradient = data.categories
    .map((c, i) => {
      const from =
        (data.categories
          .slice(0, i)
          .reduce((sum, item) => sum + item.amount, 0) /
          Math.max(data.monthly, 1)) *
        100;
      const to = from + (c.amount / Math.max(data.monthly, 1)) * 100;
      return `${colors[i % colors.length]} ${from}% ${to}%`;
    })
    .join(',');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">БОЛЬШЕ ЯСНОСТИ. МЕНЬШЕ СЮРПРИЗОВ.</div>
          <h1>Ваши регулярные расходы</h1>
          <p>Всё, что предстоит оплатить — в одном месте.</p>
        </div>
        <div className="page-actions">
          <span className="date-chip">
            <CalendarDays size={16} />
            {new Date(asOf + 'T00:00:00Z').toLocaleDateString('ru-RU', {
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </span>
          {options.length > 1 && (
            <SelectField
              label="Валюта обзора"
              value={currency}
              onChange={setCurrency}
              options={options.map((v) => ({ value: v, label: v }))}
            />
          )}
          <ExpenseForm buttonLabel="Добавить" guest={guest} />
        </div>
      </div>
      {pending > 0 && (
        <a href="/detected" className="pending-banner">
          <span>
            <strong>{pending} возможных расходов ждут подтверждения</strong> ·
            Проверьте результат импорта
          </span>
          <ArrowRight size={18} />
        </a>
      )}
      <div className="dashboard-top">
        <section className="hero-finance panel">
          <div className="hero-label">
            <span>Регулярные расходы</span>
            <span className="hero-small-icon">
              <Wallet size={19} />
            </span>
          </div>
          <div className="hero-amount">
            {money(data.monthly, currency)}
            <span>/ месяц</span>
          </div>
          <div className="hero-year">
            ≈ {money(data.yearly, currency)} <span>за год</span>
          </div>
          <div className="hero-foot">
            <span className="active-dot" />
            <span>На основе {data.activeCount} активных расходов</span>
            <Info size={14} />
          </div>
        </section>
        <section className="panel forecast-card">
          <div className="section-title">
            <h2>Впереди 6 месяцев</h2>
            <ChartNoAxesCombined size={19} />
          </div>
          <p>Ожидаемые платежи по календарю</p>
          <ForecastChart months={data.months} currency={currency} />
          <div className="forecast-caption">
            <span className="legend-dot" />
            {data.months[0].label}: оставшиеся платежи месяца
          </div>
        </section>
      </div>
      <div className="kpi-grid">
        <section className="panel kpi">
          <div>
            <span>Подписки и цифровые сервисы</span>
            <span className="kpi-icon">
              <Repeat2 size={17} />
            </span>
          </div>
          <strong>
            {money(data.subscriptions, currency)}
            <small>/ мес.</small>
          </strong>
          <p>Подписки, софт и облака</p>
        </section>
        <section className="panel kpi">
          <div>
            <span>Обязательные расходы</span>
            <span className="kpi-icon">
              <House size={17} />
            </span>
          </div>
          <strong>
            {money(data.required, currency)}
            <small>/ мес.</small>
          </strong>
          <p>Дом, связь и другие обязательства</p>
        </section>
        <section className="panel kpi">
          <div>
            <span>До конца месяца</span>
            <span className="kpi-icon">
              <CalendarDays size={17} />
            </span>
          </div>
          <strong>≈ {money(data.toMonthEnd, currency)}</strong>
          <p>Ожидаемые списания с {dateLabel(asOf)}</p>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel upcoming-panel">
          <div className="section-title">
            <h2>Ближайшие списания</h2>
            <a className="text-link" href="/expenses">
              Все расходы
              <ArrowUpRight size={14} />
            </a>
          </div>
          {data.upcoming.length ? (
            <div className="upcoming-list">
              {data.upcoming.slice(0, 6).map((p) => (
                <a
                  key={p.expense.id + p.date}
                  href={'/expenses/' + p.expense.id}
                >
                  <div className="payment-date">
                    <strong>{Number(p.date.slice(8))}</strong>
                    <span>
                      {new Date(p.date + 'T00:00:00Z')
                        .toLocaleDateString('ru-RU', {
                          month: 'short',
                          timeZone: 'UTC',
                        })
                        .replace('.', '')}
                    </span>
                  </div>
                  <ServiceLogo
                    name={p.expense.name}
                    serviceId={p.expense.serviceId}
                    type={p.expense.type}
                  />
                  <div className="payment-name">
                    <strong>{p.expense.name}</strong>
                    <span>
                      {daysBetween(asOf, p.date) === 0
                        ? 'Ожидается сегодня'
                        : daysBetween(asOf, p.date) === 1
                          ? 'Ожидается завтра'
                          : 'Примерно через ' +
                            daysBetween(asOf, p.date) +
                            ' дн.'}
                    </span>
                  </div>
                  <strong className="payment-amount">
                    {p.expense.type === 'utility' ? '≈ ' : ''}
                    {money(p.amountMinor, currency)}
                  </strong>
                  <ChevronRight size={16} />
                </a>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <CalendarDays size={28} />
              <p>В ближайшие три месяца списаний с известной датой нет.</p>
            </div>
          )}
          <div className="panel-foot">
            <Info size={13} />
            Даты и суммы — прогноз по истории платежей.
          </div>
        </section>
        <section className="panel category-panel">
          <div className="section-title">
            <h2>Структура расходов</h2>
            <span className="muted">в месяц</span>
          </div>
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: gradient
                  ? 'conic-gradient(' + gradient + ')'
                  : 'var(--surface-raised)',
              }}
              role="img"
              aria-label={data.categories
                .map((c) => c.label + ': ' + money(c.amount, currency))
                .join('; ')}
            >
              <div>
                <strong>{data.activeCount}</strong>
                <span>расходов</span>
              </div>
            </div>
          </div>
          <div className="category-legend">
            {data.categories.map((c, i) => (
              <div key={c.type}>
                <span style={{ background: colors[i % colors.length] }} />
                <span>{c.label}</span>
                <strong>{money(c.amount, currency)}</strong>
                <small>
                  {Math.round((c.amount / Math.max(data.monthly, 1)) * 100)}%
                </small>
              </div>
            ))}
          </div>
        </section>
      </div>
      {data.missingDates > 0 && (
        <div className="quiet-note">
          <Info size={17} />
          <p>
            У {data.missingDates} расходов не указана дата: они включены в
            стоимость за месяц, но не в календарный прогноз.
          </p>
        </div>
      )}
      <SavingsBanner items={projection.recommendations} currency={currency} />
      <div className="dashboard-import">
        <div>
          <UploadCloud size={20} />
          <span>
            <strong>Картина становится точнее с каждой выпиской</strong>
            <small>Добавьте свежие операции, чтобы обновить историю.</small>
          </span>
        </div>
        <a href="/import" className="secondary-button">
          Импортировать
          <ArrowUpRight size={15} />
        </a>
      </div>
    </>
  );
}
