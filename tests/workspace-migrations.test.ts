import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { emptyWorkspace } from '../lib/local/schema.ts';
import { migrateWorkspace } from '../lib/local/migrations.ts';
import { readWorkspace, clearWorkspace } from '../lib/local/repository.ts';
test('workspace upgrades are pure and reject future/malformed data', () => {
  const old = {
    ...emptyWorkspace(),
    schemaVersion: 1,
    revision: 14,
    started: true,
  };
  assert.equal(migrateWorkspace(old).schemaVersion, 2);
  assert.equal(migrateWorkspace(old).revision, 14);
  assert.equal(old.schemaVersion, 1);
  assert.throws(() => migrateWorkspace({ ...old, schemaVersion: 99 }));
  assert.throws(() => migrateWorkspace({ ...old, expenses: [{}] }));
});
test('old IndexedDB migrates atomically; invalid records survive; explicit reset removes backups', async () => {
  Object.defineProperty(globalThis, 'window', {
    value: new EventTarget(),
    configurable: true,
  });
  await readWorkspace();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('potok-local-v1', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const put = (value: unknown) =>
    new Promise<void>((resolve, reject) => {
      const t = db.transaction('workspace', 'readwrite');
      t.objectStore('workspace').put(value, 'current');
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error);
    });
  const get = (key: string) =>
    new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const r = db.transaction('workspace').objectStore('workspace').get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  const old = {
    ...emptyWorkspace(),
    schemaVersion: 1,
    revision: 8,
    started: true,
  };
  await put(old);
  assert.equal((await readWorkspace()).schemaVersion, 2);
  assert.deepEqual(await get('pre-migration-1'), old);
  assert.equal((await get('current'))?.revision, 8);
  const future = { ...old, schemaVersion: 99 };
  await put(future);
  await assert.rejects(readWorkspace());
  assert.deepEqual(await get('current'), future);
  await put({ ...old, schemaVersion: 2 });
  await clearWorkspace();
  assert.equal(await get('pre-migration-1'), undefined);
  assert.equal((await get('current'))?.revision, 9);
  db.close();
});
