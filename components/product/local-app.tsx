'use client';
import { useState } from 'react';
import { Shell } from './shell';
import { Dashboard } from './dashboard';
import { ExpenseList } from './expense-list';
import { ExpenseForm } from './expense-form';
import { ImportForm } from './import-form';
import { CandidateList } from './candidate-list';
import { RecommendationsPage } from './recommendations';
import { LocalDetail } from './local-detail';
import { LocalSettings } from './local-settings';
import { projectDashboard } from '@/lib/domain/projections';
import { today } from '@/lib/domain/calendar';
import { useLocalWorkspace } from '@/hooks/use-local-workspace';
export function LocalApp() {
  const { state, path, error, status } = useLocalWorkspace();
  const [dashboardDate, setDashboardDate] = useState(today());
  const active = path.startsWith('/expenses')
    ? 'expenses'
    : path === '/import' || path === '/detected'
      ? 'import'
      : path === '/recommendations'
        ? 'recommendations'
        : path.startsWith('/settings')
          ? 'settings'
          : 'overview';
  if (!state)
    return (
      <Shell active={active}>
        <p role={error ? 'alert' : 'status'}>
          {error || 'Открываем данные на устройстве…'}
        </p>
        {error && (
          <button
            className="secondary-button"
            onClick={() => location.reload()}
          >
            Повторить
          </button>
        )}
      </Shell>
    );
  const pending = state.candidates.filter((c) => c.decision === 'pending');
  return (
    <Shell active={active}>
      {['error', 'conflict'].includes(status) && (
        <p role="status" className="source-notice">
          {status === 'conflict'
            ? 'На другом устройстве есть новая версия. Выберите действие в разделе «Ваш Поток».'
            : 'Не удалось синхронизировать данные. Проверьте подключение в разделе «Ваш Поток».'}{' '}
          <a href="/settings/sync">Ваш Поток</a>
        </p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {active === 'overview' && (
        <Dashboard
          projection={projectDashboard(
            state.expenses,
            state.transactions,
            dashboardDate,
            state.settings.baseCurrency,
          )}
          pending={pending.length}
          onDateChange={setDashboardDate}
        />
      )}
      {path === '/expenses' && (
        <>
          <div className="page-heading">
            <div>
              <h1>Регулярные расходы</h1>
              <p>Все повторяющиеся платежи под вашим контролем.</p>
            </div>
            <ExpenseForm />
          </div>
          <ExpenseList expenses={state.expenses} />
        </>
      )}
      {path.startsWith('/expenses/') && (
        <LocalDetail
          id={decodeURIComponent(path.split('/')[2])}
          state={state}
        />
      )}
      {path === '/import' && <ImportForm imports={state.imports} />}
      {path === '/detected' && (
        <CandidateList
          key={pending.map((c) => c.id + ':' + c.expense.updatedAt).join()}
          initial={pending}
          transactions={state.transactions}
        />
      )}
      {path === '/recommendations' && (
        <RecommendationsPage
          expenses={state.expenses}
          items={
            projectDashboard(state.expenses, state.transactions).recommendations
          }
        />
      )}
      {path.startsWith('/settings') && (
        <LocalSettings state={state} status={status} />
      )}
    </Shell>
  );
}
