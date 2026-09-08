import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as nodeCrypto from 'node:crypto';
import { z } from 'zod';
import * as crypt from '../lib/vault/crypto.ts';
/** Contract test runs real endpoint service against an isolated SQL boundary. Live PostgreSQL is tested separately. */
function service() {
  const rows = new Map<
      string,
      { auth_verifier_hash: string; encrypted_blob: string; version: number }
    >(),
    writes: unknown[][] = [];
  const pool = {
    query: async (sql: string, v: unknown[]) => {
      if (sql.startsWith('INSERT')) {
        writes.push(v);
        const id = String(v[0]);
        if (rows.has(id)) return { rows: [] };
        rows.set(id, {
          auth_verifier_hash: String(v[1]),
          encrypted_blob: String(v[2]),
          version: 1,
        });
        return { rows: [{ version: 1 }] };
      }
      if (sql.startsWith('SELECT'))
        return {
          rows: rows.has(String(v[0])) ? [{ ...rows.get(String(v[0])) }] : [],
        };
      if (sql.startsWith('UPDATE')) {
        assert.equal(v.length,5,'schema version parameter must be supplied to PostgreSQL');
        assert.equal(v[4],2);
        const row = rows.get(String(v[1]));
        if (!row || row.version !== v[2]) return { rows: [] };
        writes.push(v);
        row.encrypted_blob = String(v[0]);
        row.version++;
        return { rows: [{ version: row.version }] };
      }
      if (sql.startsWith('DELETE')) {
        rows.delete(String(v[0]));
        return { rows: [] };
      }
      throw new Error('Unexpected SQL');
    },
  };
  const mod = {
    exports: {} as Record<
      'createVault' | 'getVault' | 'putVault' | 'deleteVault',
      (req: Request, id?: string) => Promise<Response>
    >,
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync('lib/server/vault.ts', 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      module: mod,
      exports: mod.exports,
      require: (name: string) => {
        if (name === 'node:crypto') return nodeCrypto;
        if (name === 'zod') return { z };
        if (name === './postgres') return { databasePool: () => pool };
        if (name === '../vault/crypto') return crypt;
        throw new Error(name);
      },
      process: { env: { APP_ORIGIN: 'https://potok.test' } },
      Buffer,
      Response,
      Uint8Array,
      TextDecoder,
      URL,
    },
  );
  return { ...mod.exports, writes, rows };
}
test('vault HTTP boundary: ciphertext only, separate auth, atomic version conflict, delete and not-found', async () => {
  const s = service(),
    id = crypto.randomUUID(),
    master = crypto.getRandomValues(new Uint8Array(32)),
    keys = await crypt.deriveKeys(master, id),
    name = 'PRIVATE-RECEIPT-NEVER-SERVER';
  const envelope = await crypt.encrypt(
    { name, amountMinor: 199900 },
    keys.encryptionKey,
    id,
  );
  const req = (method: string, body?: unknown, token = keys.authSecret) =>
    new Request('https://potok.test/api/vaults/' + id, {
      method,
      headers: {
        Origin: 'https://potok.test',
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await s.createVault(req('POST', { id, envelope }))).status,
    201,
  );
  const a = (await (await s.getVault(req('GET'), id)).json()) as {
      version: number;
      envelope: crypt.Envelope;
    },
    b = (await (await s.getVault(req('GET'), id)).json()) as {
      version: number;
      envelope: crypt.Envelope;
    };
  assert.equal(a.version, 1);
  assert.equal(b.version, 1);
  assert.equal(
    (
      (await (
        await s.putVault(
          req('PUT', { expectedVersion: a.version, envelope }),
          id,
        )
      ).json()) as { version: number }
    ).version,
    2,
  );
  await assert.rejects(
    () => s.putVault(req('PUT', { expectedVersion: b.version, envelope }), id),
    (e: unknown) => (e as { status: number }).status === 409,
  );
  await assert.rejects(
    () =>
      s.getVault(
        req(
          'GET',
          undefined,
          crypt.encode(crypto.getRandomValues(new Uint8Array(32))),
        ),
        id,
      ),
    (e: unknown) => (e as { status: number }).status === 401,
  );
  await assert.rejects(
    () =>
      s.putVault(
        req('PUT', { expectedVersion: 2, envelope, transactions: [name] }),
        id,
      ),
    (e: unknown) => (e as { status: number }).status === 400,
  );
  assert.ok(!JSON.stringify(s.writes).includes(name));
  assert.ok(!JSON.stringify(s.writes).includes(keys.authSecret));
  const restored = await crypt.deriveKeys(
    crypt.parseRecovery(crypt.recoveryString(id, master)).secret,
    id,
  );
  assert.deepEqual(
    await crypt.decrypt(a.envelope, restored.encryptionKey, id),
    { name, amountMinor: 199900 },
  );
  await s.deleteVault(req('DELETE'), id);
  await assert.rejects(
    () => s.getVault(req('GET'), id),
    (e: unknown) => (e as { status: number }).status === 404,
  );
});
