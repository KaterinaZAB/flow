import {migrateWorkspace} from '../lib/local/migrations.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypt from '../lib/vault/crypto.ts';
import {
  emptyWorkspace,
  workspaceSchema,
  type Workspace,
} from '../lib/local/schema.ts';
type DeviceAPI = typeof import('../lib/vault/sync.ts');
function fixture() {
  const clouds = new Map<
      string,
      { version: number; envelope: crypt.Envelope; auth: string }
    >(),
    payloads: string[] = [];
  const fetch = async (path: string, init: RequestInit) => {
    const method = init.method ?? 'GET',
      body = typeof init.body === 'string' ? JSON.parse(init.body) : null,
      id = method === 'POST' ? body.id : path.split('/').pop()!,
      auth = new Headers(init.headers).get('Authorization')!;
    if (body) payloads.push(JSON.stringify(body));
    let cloud = clouds.get(id);
    if (method === 'POST') {
      if (cloud) return Response.json({}, { status: 409 });
      cloud = { version: 1, envelope: body.envelope, auth };
      clouds.set(id, cloud);
    } else {
      if (!cloud) return Response.json({}, { status: 404 });
      if (auth !== cloud.auth) return Response.json({}, { status: 401 });
      if (method === 'PUT') {
        if (body.expectedVersion !== cloud.version)
          return Response.json({}, { status: 409 });
        cloud.version++;
        cloud.envelope = body.envelope;
      }
      if (method === 'DELETE') {
        clouds.delete(id);
        return Response.json({ deleted: true });
      }
    }
    return Response.json({ version: cloud.version, envelope: cloud.envelope });
  };
  function device() {
    let state = emptyWorkspace();
    const store = new Map<string, unknown>();
    const repo = {
      deviceGet: async (key: string) => store.get(key),
      devicePut: async (key: string, v: unknown) => {
        if (v === undefined) store.delete(key);
        else store.set(key, structuredClone(v));
      },
      readWorkspace: async () => structuredClone(state),
      updateWorkspace: async (change: (s: Workspace) => Workspace | void) => {
        const old = structuredClone(state),
          next = change(old) ?? old;
        next.revision = state.revision + 1;
        state = workspaceSchema.parse(next);
      },
    };
    const mod = { exports: {} as DeviceAPI };
    const context = {
      exports: mod.exports,
      module: mod,
      require: (name: string) => {
        if (name === '../local/repository') return repo;
        if (name === '../local/migrations') return { migrateWorkspace };
        if (name === './crypto') return crypt;
        throw new Error(name);
      },
      navigator: {
        onLine: true,
        locks: {
          request: async (_name: string, fn: () => Promise<unknown>) => fn(),
        },
      },
      window: { dispatchEvent: () => {} },
      CustomEvent: class {
        type: string;
        init: unknown;
        constructor(type: string, init: unknown) {
          this.type = type;
          this.init = init;
        }
      },
      crypto,
      fetch,
      Date,
    };
    vm.runInNewContext(
      ts.transpileModule(readFileSync('lib/vault/sync.ts', 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      context,
    );
    return { api: mod.exports, repo };
  }
  return { device, payloads, clouds };
}
test('real sync coordinator: recovery, two-device conflict, explicit cloud resolution, deletion, no plaintext transport', async () => {
  const f = fixture(),
    a = f.device(),
    b = f.device();
  await a.repo.updateWorkspace((s) => {
    s.started = true;
    s.settings.baseCurrency = 'USD';
  });
  const key = await a.api.enableSync();
  await a.api.acknowledgeRecovery();
  await b.api.restore(key);
  assert.equal((await b.repo.readWorkspace()).settings.baseCurrency, 'USD');
  await a.repo.updateWorkspace((s) => {
    s.settings.baseCurrency = 'EUR';
  });
  await b.repo.updateWorkspace((s) => {
    s.settings.baseCurrency = 'GBP';
  });
  await a.api.syncNow();
  await assert.rejects(() => b.api.syncNow());
  assert.equal((await b.repo.readWorkspace()).settings.baseCurrency, 'GBP');
  await b.api.syncNow('cloud');
  assert.equal((await b.repo.readWorkspace()).settings.baseCurrency, 'EUR');
  assert.ok(!f.payloads.join().includes('baseCurrency'));
  assert.ok(!f.payloads.join().includes(key));
  const local = await b.repo.readWorkspace();
  await b.api.deleteCloud();
  assert.deepEqual(await b.repo.readWorkspace(), local);
  await assert.rejects(() => a.api.restore(key));
});
