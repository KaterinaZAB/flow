'use client';

import type { Workspace } from '@/lib/local/schema';
import { SelectField } from './select-field';

export function GeneralSettings({
  state,
  onCurrencyChange,
}: {
  state: Workspace;
  onCurrencyChange: (currency: Workspace['settings']['baseCurrency']) => void;
}) {
  return (
    <section className="panel settings-panel">
      <h2>Основные настройки</h2>
      <p>
        Настройте Поток под себя. Предпочтения сохраняются на этом устройстве.
      </p>
      <SelectField
        label="Основная валюта"
        value={state.settings.baseCurrency}
        onChange={(value) =>
          onCurrencyChange(value as Workspace['settings']['baseCurrency'])
        }
        options={['RUB', 'USD', 'EUR', 'GBP', 'KZT', 'BYN', 'GEL', 'TRY'].map(
          (c) => ({ value: c, label: c }),
        )}
      />
    </section>
  );
}

export function DataSettings({
  busy,
  onClearImports,
  onReset,
}: {
  busy: boolean;
  onClearImports: () => void;
  onReset: () => void;
}) {
  return (
    <section className="panel settings-panel">
      <h2>Данные</h2>
      <p>
        Расходы и операции хранятся в браузере на вашем устройстве. Выписки
        обрабатываются здесь же и не отправляются на сервер.
      </p>
      <p>
        Очистка данных браузера удалит локальное рабочее пространство и ключи.
        Для восстановления сохраните резервную копию и ключ восстановления.
      </p>
      <div className="page-actions">
        <button
          disabled={busy}
          className="danger-button"
          onClick={onClearImports}
        >
          Удалить импортированные данные
        </button>
        <button disabled={busy} className="danger-button" onClick={onReset}>
          Удалить все локальные данные
        </button>
      </div>
    </section>
  );
}

export function DataSources({
  imports,
  transactionCount,
}: {
  imports: Workspace['imports'];
  transactionCount: number;
}) {
  return (
    <section id="sources" className="panel settings-panel">
      <h2>Источники данных</h2>
      <h3>Банковские выписки</h3>
      <p>
        Локальный импорт доступен · {imports.length} импортов ·{' '}
        {transactionCount} операций
      </p>
      <a className="primary-button" href="/import">
        Загрузить выписку
      </a>
      <details className="settings-import-history">
        <summary>История импортов ({imports.length})</summary>
        {imports.length ? (
          <ul>
            {[...imports].reverse().map((item) => (
              <li key={item.id}>
                <strong>{item.filename}</strong>
                <span>
                  {new Date(item.createdAt).toLocaleDateString('ru-RU')} ·{' '}
                  {item.status === 'completed'
                    ? `${item.transactionCount} операций`
                    : item.status === 'failed'
                      ? 'Не удалось обработать'
                      : 'Обработка'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Пока нет импортов. Загрузите выписку, чтобы найти регулярные
            расходы.
          </p>
        )}
      </details>
    </section>
  );
}

export function AboutFlow() {
  return (
    <section className="panel settings-panel">
      <h2>О приложении</h2>
      <p>
        Поток помогает следить за регулярными расходами. Основные функции
        доступны без сети после первой загрузки.
      </p>
      <div className="page-actions">
        <a className="secondary-button" href="/privacy">
          Конфиденциальность
        </a>
        <a className="secondary-button" href="/terms">
          Условия использования
        </a>
      </div>
    </section>
  );
}
