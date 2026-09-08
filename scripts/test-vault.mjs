import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { deriveKeys, encrypt, decrypt } from '../lib/vault/crypto.ts';
if (process.env.RUN_VAULT_E2E !== 'yes')
  throw new Error(
    'Use an isolated test database/app and set RUN_VAULT_E2E=yes',
  );
const origin = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000')
  .origin;
const { Client } = createRequire(resolve('backend/package.json'))('pg');
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const id = crypto.randomUUID(),
  secret = crypto.getRandomValues(new Uint8Array(32)),
  keys = await deriveKeys(secret, id);
const value = {
  privateService: 'TEST-PRIVATE-FINANCIAL-CANARY',
  amountMinor: 199900,
};
const request = (method, body) =>
  fetch(origin + '/api/vaults' + (method === 'POST' ? '' : '/' + id), {
    method,
    headers: {
      Origin: origin,
      Authorization: 'Bearer ' + keys.authSecret,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
try {
  assert.equal((await fetch(origin + '/health')).status, 200);
  assert.equal(
    (
      await request('POST', {
        id,
        envelope: await encrypt(value, keys.encryptionKey, id),
      })
    ).status,
    201,
  );
  const remote = await (await request('GET')).json();
  const deviceB = await deriveKeys(secret, id);
  assert.deepEqual(
    await decrypt(remote.envelope, deviceB.encryptionKey, id),
    value,
  );
  const payload = {
    expectedVersion: remote.version,
    envelope: await encrypt(value, keys.encryptionKey, id),
  };
  const responses = await Promise.all([
    request('PUT', payload),
    request('PUT', payload),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status).sort((a, b) => a - b),
    [200, 409],
  );
  const stored = await db.query('SELECT * FROM vaults WHERE id=$1', [id]);
  const serialized = JSON.stringify(stored.rows);
  assert.ok(!serialized.includes(value.privateService));
  assert.ok(!serialized.includes(keys.authSecret));
  const tables = await db.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
  );
  assert.ok(
    !tables.rows.some((r) =>
      [
        'users',
        'transactions',
        'recurring_expenses',
        'gmail_receipts',
      ].includes(r.table_name),
    ),
  );
  console.log(
    'PASS: PostgreSQL ciphertext storage, recovery, atomic 409 conflict, no plaintext or raw auth secret in database',
  );
} finally {
  await request('DELETE');
  await db.end();
  secret.fill(0);
}
