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
import { updateWorkspace } from '@/lib/local/repository';
import { projectDashboard } from '@/lib/domain/projections';
import { demoExpenses, demoTransactions } from '@/lib/demo/data';
import { useLocalWorkspace } from '@/hooks/use-local-workspace';
export function LocalApp() {
  const { state, path, error, setError, status } = useLocalWorkspace();
  const [demo, setDemo] = useState(false);
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
  const data = demo
    ? {
        ...state,
        expenses: demoExpenses,
        transactions: demoTransactions,
        candidates: [],
      }
    : state;
  const pending = data.candidates.filter((c) => c.decision === 'pending');
  return (
    <Shell active={active}>
      {['offline', 'error', 'conflict'].includes(status) && (
        <p role="status" className="source-notice">
          {status === 'conflict'
            ? 'На другом устройстве есть новая версия. Выберите действие в настройках.'
            : 'Изменения сохранены на устройстве. Синхронизация будет выполнена позже.'}{' '}
          <a href="/settings/sync">Хранение и синхронизация</a>
        </p>
      )}
      {!state.started && active === 'overview' && (
        <section className="panel settings-panel">
          <h1>Регулярные расходы под контролем</h1>
          <p>Начните на этом устройстве или восстановите сохранённый сейф.</p>
          <div className="page-actions">
            <button
              className="primary-button"
              onClick={() =>
                void updateWorkspace((s) => {
                  s.started = true;
                }).catch((e) => setError(e.message))
              }
            >
              Начать
            </button>
            <a className="secondary-button" href="/settings/sync">
              Восстановить данные
            </a>
            <button className="text-link" onClick={() => setDemo(!demo)}>
              {demo ? 'Закрыть пример' : 'Посмотреть пример'}
            </button>
          </div>
        </section>
      )}
      {demo && (
        <p className="source-notice">
          Пример · Вымышленные расходы не сохраняются.{' '}
          <button onClick={() => setDemo(false)}>Закрыть пример</button>
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
            data.expenses,
            data.transactions,
            undefined,
            state.settings.baseCurrency,
          )}
          pending={pending.length}
          guest={demo}
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
