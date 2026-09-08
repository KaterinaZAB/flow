import { emptyWorkspace, workspaceSchema, type Workspace } from './schema.ts';
import { migrateWorkspace } from './migrations.ts';
let connection: Promise<IDBDatabase> | undefined;
function database() {
  return (connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('potok-local-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('workspace');
      request.result.createObjectStore('device');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(new Error('Не удалось открыть локальное хранилище.'));
    };
    request.onblocked = () =>
      reject(new Error('Закройте другие вкладки Потока и повторите.'));
  }));
}
export async function deviceGet<T>(key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('device').objectStore('device').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function devicePut(key: string, value: unknown) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('device', 'readwrite');
    if (value === undefined) t.objectStore('device').delete(key);
    else t.objectStore('device').put(value, key);
    t.oncomplete = () => resolve();
    t.onabort = () =>
      reject(new Error('Не удалось сохранить настройки устройства.'));
  });
}
export async function readWorkspace(): Promise<Workspace> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite'),
      store = tx.objectStore('workspace'),
      r = store.get('current');
    let result: Workspace;
    r.onsuccess = () => {
      try {
        result =
          r.result === undefined
            ? emptyWorkspace()
            : migrateWorkspace(r.result);
        if (
          r.result !== undefined &&
          r.result.schemaVersion !== result.schemaVersion
        ) {
          store.put(r.result, 'pre-migration-' + r.result.schemaVersion);
          store.put(result, 'current');
        }
      } catch {
        tx.abort();
        reject(
          new Error(
            'Формат локальных данных не поддерживается. Данные сохранены; не очищайте хранилище.',
          ),
        );
      }
    };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(new Error('Не удалось открыть данные. Исходная копия сохранена.'));
  });
}
/** A single IndexedDB read/write transaction prevents lost updates between tabs. No async work inside the reducer. */
export async function updateWorkspace(
  change: (state: Workspace) => Workspace | void,
  clearHistory = false,
) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite'),
      store = tx.objectStore('workspace'),
      r = store.get('current');
    r.onsuccess = () => {
      try {
        const old = migrateWorkspace(r.result ?? emptyWorkspace()),
          next = change(old) ?? old;
        next.revision = old.revision + 1;
        if (clearHistory) store.clear();
        else if (r.result && r.result.schemaVersion !== old.schemaVersion)
          store.put(r.result, 'pre-migration-' + r.result.schemaVersion);
        store.put(workspaceSchema.parse(next), 'current');
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        new Error(
          'Изменения не сохранены. Проверьте данные и свободное место.',
        ),
      );
  });
  window.dispatchEvent(new Event('potok:local-change'));
  const channel = new BroadcastChannel('potok-local');
  channel.postMessage('changed');
  channel.close();
}
/** Explicit device reset also erases retained pre-migration copies. */
export const clearWorkspace = () =>
  updateWorkspace(() => emptyWorkspace(), true);
export const localExpenses = {
  list: async () => (await readWorkspace()).expenses,
};
export const localTransactions = {
  list: async () => (await readWorkspace()).transactions,
};
export const localSettings = {
  get: async () => (await readWorkspace()).settings,
};
