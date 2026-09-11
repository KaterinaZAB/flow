'use client';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  GeneralSettings,
  DataSettings,
  DataSources,
  AboutFlow,
} from './settings-sections';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { localCommand } from '@/lib/local/actions';
import { type Workspace } from '@/lib/local/schema';
import {
  devicePut,
  updateWorkspace,
  clearWorkspace,
} from '@/lib/local/repository';
import {
  enableSync,
  getDevice,
  showRecovery,
  acknowledgeRecovery,
  restore,
  syncNow,
  deleteCloud,
  encryptedBackup,
  type Device,
  type SyncStatus,
} from '@/lib/vault/sync';
function download(name: string, data: string) {
  const url = URL.createObjectURL(
      new Blob([data], { type: 'application/json' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LocalSettings({
  state,
  status,
}: {
  state: Workspace;
  status: SyncStatus;
}) {
  const [device, setDevice] = useState<Device | undefined>(),
    [key, setKey] = useState(''),
    [input, setInput] = useState(''),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState<
      | 'imported'
      | 'cloud'
      | 'local'
      | 'restore'
      | 'cloud-version'
      | 'local-version'
      | null
    >(null),
    [backup, setBackup] = useState<unknown>(),
    [restoreMethod, setRestoreMethod] = useState<'key' | 'backup'>('key');
  const refresh = () => getDevice().then(setDevice);
  useEffect(() => {
    void refresh()
      .then(() => getDevice())
      .then((d) => {
        if (d && !d.acknowledged) void showRecovery().then(setKey);
      });
  }, []);
  useEffect(() => {
    const section =
      window.location.pathname === '/settings/sync'
        ? 'sync'
        : window.location.pathname === '/settings/sources'
          ? 'sources'
          : null;
    if (section)
      document.getElementById(section)?.scrollIntoView({ block: 'start' });
  }, []);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Не удалось выполнить действие.',
      );
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  async function confirmed() {
    await run(async () => {
      if (confirm === 'cloud') await deleteCloud();
      if (confirm === 'imported') {
        const result = await localCommand('/data', { method: 'DELETE' });
        if (!result.ok)
          throw new Error('Не удалось удалить импортированные данные.');
      }
      if (confirm === 'local') {
        await navigator.locks.request('potok-sync', async () => {
          await devicePut('sync', undefined);
          await devicePut('recovery', undefined);
          await clearWorkspace();
        });
      }
      if (confirm === 'restore') {
        await restore(input, restoreMethod === 'backup' ? backup : undefined);
        setInput('');
        setBackup(undefined);
      }
      if (confirm === 'cloud-version') await syncNow('cloud');
      if (confirm === 'local-version') await syncNow('local');
      setConfirm(null);
    });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ваш Поток</h1>
          <p>Настройки, данные и защищённая синхронизация</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <div className="settings-stack">
        <GeneralSettings
          state={state}
          onCurrencyChange={(value) =>
            void run(() =>
              updateWorkspace((s) => {
                s.settings.baseCurrency = value;
              }),
            )
          }
        />
        <DataSettings
          busy={busy}
          onClearImports={() => setConfirm('imported')}
          onReset={() => setConfirm('local')}
        />
        <section id="sync" className="panel settings-panel">
          <h2>Синхронизация</h2>
          <p role="status">
            {device
              ? device.lastSyncAt
                ? 'Защищённая синхронизация включена'
                : 'Настройка синхронизации не завершена'
              : 'Только это устройство'}
          </p>
          <p>
            Перед отправкой данные шифруются на вашем устройстве. Сервер хранит
            зашифрованную копию и не получает ключ расшифровки.
          </p>
          {device ? (
            <>
              <p>
                Последняя синхронизация:{' '}
                {device.lastSyncAt
                  ? new Date(device.lastSyncAt).toLocaleString('ru-RU')
                  : 'ещё не завершена'}
              </p>
              <div className="page-actions">
                <button
                  disabled={busy}
                  className="primary-button"
                  onClick={() => void run(() => syncNow())}
                >
                  Синхронизировать сейчас
                </button>
                <button
                  disabled={busy}
                  className="danger-button"
                  onClick={() => setConfirm('cloud')}
                >
                  Удалить облачную копию
                </button>
              </div>
            </>
          ) : (
            <button
              disabled={busy}
              className="primary-button"
              onClick={() =>
                void run(async () => {
                  setSaved(false);
                  setKey(await enableSync());
                })
              }
            >
              Включить защищённую синхронизацию
            </button>
          )}
          {status === 'conflict' && (
            <div className="error-box">
              <p>
                На другом устройстве есть более новая версия данных. Сначала
                можно скачать зашифрованную резервную копию текущих данных.
              </p>
              <button
                disabled={busy}
                className="secondary-button"
                onClick={() => setConfirm('cloud-version')}
              >
                Загрузить облачную версию
              </button>
              <button
                disabled={busy}
                className="danger-button"
                onClick={() => setConfirm('local-version')}
              >
                Перезаписать облачную версию
              </button>
            </div>
          )}
        </section>
        <section id="recovery" className="panel settings-panel">
          <h2>Восстановление</h2>
          {device && (
            <button
              disabled={busy}
              className="secondary-button"
              onClick={() =>
                void run(async () => {
                  setSaved(false);
                  setKey(await showRecovery());
                })
              }
            >
              Подключить устройство / ключ восстановления
            </button>
          )}
          <h3>Восстановить данные</h3>
          <div
            className="settings-tabs"
            role="tablist"
            aria-label="Способ восстановления"
          >
            <button
              type="button"
              role="tab"
              aria-selected={restoreMethod === 'key'}
              className={restoreMethod === 'key' ? 'active' : undefined}
              onClick={() => setRestoreMethod('key')}
            >
              Ключ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={restoreMethod === 'backup'}
              className={restoreMethod === 'backup' ? 'active' : undefined}
              onClick={() => setRestoreMethod('backup')}
            >
              Резервная копия
            </button>
          </div>
          {restoreMethod === 'key' ? (
            <label className="form-field">
              Ключ восстановления
              <Input
                type="password"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="POTOK1:…"
              />
            </label>
          ) : (
            <>
              <label className="form-field">
                Выберите зашифрованную резервную копию
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) =>
                    void run(async () => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 9 * 1024 * 1024)
                        throw new Error('Файл слишком большой.');
                      const data = JSON.parse(await f.text());
                      setBackup(data.envelope);
                    })
                  }
                />
              </label>
              <label className="form-field">
                Ключ восстановления
                <Input
                  type="password"
                  autoComplete="off"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="POTOK1:…"
                />
              </label>
            </>
          )}
          <button
            disabled={busy || !input || (restoreMethod === 'backup' && !backup)}
            className="secondary-button"
            onClick={() => setConfirm('restore')}
          >
            Восстановить
          </button>
          <h3>Создать резервную копию</h3>
          <p>
            Зашифрованный файл создаётся на устройстве. Сохраните его и
            отдельный ключ: они понадобятся вместе для восстановления.
          </p>
          <button
            disabled={busy}
            className="secondary-button"
            onClick={() =>
              void run(async () => {
                const b = await encryptedBackup();
                download(
                  'potok-encrypted-backup.json',
                  JSON.stringify(b.backup),
                );
                setSaved(false);
                setKey(b.key);
              })
            }
          >
            Скачать зашифрованную резервную копию
          </button>
        </section>
        <DataSources
          imports={state.imports}
          transactionCount={state.transactions.length}
        />
        <AboutFlow />
      </div>
      <Dialog
        open={!!key}
        onOpenChange={(open) => {
          if (!open && saved) {
            setKey('');
          }
        }}
      >
        <DialogContent className="sm:max-w-[580px] p-7">
          <DialogHeader>
            <DialogTitle>Сохраните ключ восстановления</DialogTitle>
            <DialogDescription>
              Без него восстановить данные после потери устройства будет
              невозможно. Не передавайте ключ другим людям.
            </DialogDescription>
          </DialogHeader>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontSize: 14,
            }}
          >
            {key}
          </pre>
          <div className="page-actions">
            <button
              className="secondary-button"
              onClick={() => void run(() => navigator.clipboard.writeText(key))}
            >
              Скопировать
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                download(
                  'potok-recovery-key.json',
                  JSON.stringify({ recoveryKey: key }),
                )
              }
            >
              Скачать ключ
            </button>
          </div>
          <label>
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />{' '}
            Я сохранил ключ восстановления
          </label>
          <button
            disabled={!saved || busy}
            className="primary-button"
            onClick={() =>
              void run(async () => {
                if (device && key.includes(device.vaultId))
                  await acknowledgeRecovery();
                setKey('');
              })
            }
          >
            Готово
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <DialogContent className="p-7">
          <DialogHeader>
            <DialogTitle>Подтвердите действие</DialogTitle>
            <DialogDescription>
              {confirm === 'imported'
                ? 'Импортированные операции и расходы будут удалены с устройства. Ручные расходы сохранятся. При включённой синхронизации изменение попадёт в облачную копию.'
                : confirm === 'cloud'
                  ? 'Облачная копия будет удалена. Локальные данные останутся.'
                  : confirm === 'local'
                    ? 'Все данные и ключи на этом устройстве будут удалены. Облачная копия останется; для неё понадобится сохранённый ключ.'
                    : confirm === 'local-version'
                      ? 'Текущие локальные данные заменят облачную версию. Изменения другого устройства не будут объединены.'
                      : 'Текущие локальные данные будут заменены после проверки выбранной копии. При необходимости сначала скачайте резервную копию.'}
            </DialogDescription>
          </DialogHeader>
          <button
            disabled={busy}
            className="danger-button"
            onClick={() => void confirmed()}
          >
            Подтвердить
          </button>
          <button
            disabled={busy}
            className="secondary-button"
            onClick={() => setConfirm(null)}
          >
            Отмена
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
