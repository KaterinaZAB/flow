import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveKeys,
  encrypt,
  decrypt,
  recoveryString,
  parseRecovery,
  envelopeSchema,
  decode,
  encode,
} from '../lib/vault/crypto.ts';
import { workspaceSchema, emptyWorkspace } from '../lib/local/schema.ts';
import { migrateWorkspace } from '../lib/local/migrations.ts';
const id = '82d368b0-187d-461d-8715-93e0bb064ca1';
test('version 1 encrypted backups remain readable and migrate without losing data', async () => {
  const keys = await deriveKeys(crypto.getRandomValues(new Uint8Array(32)), id);
  const old = {
    ...emptyWorkspace(),
    schemaVersion: 1,
    revision: 7,
    started: true,
  };
  const iv = crypto.getRandomValues(new Uint8Array(12)),
    text = new TextEncoder();
  const bytes = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: text.encode(`potok|${id}|1|AES-256-GCM|1`),
      tagLength: 128,
    },
    keys.encryptionKey,
    text.encode(JSON.stringify(old)),
  );
  const envelope = {
    encryptionVersion: 1,
    algorithm: 'AES-256-GCM',
    schemaVersion: 1,
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(bytes)),
  };
  assert.deepEqual(
    migrateWorkspace(await decrypt(envelope, keys.encryptionKey, id)),
    { ...old, schemaVersion: 2 },
  );
});
test('AES-GCM roundtrip; independent device derives same keys from recovery package', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32)),
    a = await deriveKeys(secret, id);
  const recovery = parseRecovery(recoveryString(id, secret)),
    b = await deriveKeys(recovery.secret, recovery.vaultId);
  const state = { ...emptyWorkspace(), started: true };
  const encrypted = await encrypt(state, a.encryptionKey, id);
  assert.deepEqual(
    workspaceSchema.parse(await decrypt(encrypted, b.encryptionKey, id)),
    state,
  );
  assert.equal(a.authSecret, b.authSecret);
  assert.equal(a.encryptionKey.extractable, false);
  await assert.rejects(() => crypto.subtle.exportKey('raw', a.encryptionKey));
});
test('wrong key, modified ciphertext and swapped vault identity fail authentication', async () => {
  const a = await deriveKeys(crypto.getRandomValues(new Uint8Array(32)), id),
    b = await deriveKeys(crypto.getRandomValues(new Uint8Array(32)), id);
  const e = await encrypt(
    { name: 'Netflix', amountMinor: 89900 },
    a.encryptionKey,
    id,
  );
  await assert.rejects(() => decrypt(e, b.encryptionKey, id));
  await assert.rejects(() =>
    decrypt(
      {
        ...e,
        ciphertext:
          (e.ciphertext[0] === 'A' ? 'B' : 'A') + e.ciphertext.slice(1),
      },
      a.encryptionKey,
      id,
    ),
  );
  await assert.rejects(() => decrypt(e, a.encryptionKey, 'different-vault'));
});
test('fresh IV per operation and auth secret cannot decrypt vault', async () => {
  const keys = await deriveKeys(crypto.getRandomValues(new Uint8Array(32)), id);
  const a = await encrypt(
      { merchant: 'PRIVATE-SERVICE', amount: 199900 },
      keys.encryptionKey,
      id,
    ),
    b = await encrypt(
      { merchant: 'PRIVATE-SERVICE', amount: 199900 },
      keys.encryptionKey,
      id,
    );
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  const wrong = await crypto.subtle.importKey(
    'raw',
    decode(keys.authSecret),
    'AES-GCM',
    false,
    ['decrypt'],
  );
  await assert.rejects(() => decrypt(a, wrong, id));
  const wire = JSON.stringify({ expectedVersion: 4, envelope: a });
  assert.ok(!wire.includes('PRIVATE-SERVICE'));
  assert.ok(!wire.includes('199900'));
  assert.ok(!wire.includes(keys.authSecret));
});
test('strict envelopes and recovered workspace reject unexpected fields and invalid data', () => {
  assert.equal(
    envelopeSchema.safeParse({ plaintext: 'Netflix' }).success,
    false,
  );
  assert.equal(
    workspaceSchema.safeParse({ ...emptyWorkspace(), schemaVersion: 3 })
      .success,
    false,
  );
  assert.equal(
    workspaceSchema.safeParse({
      ...emptyWorkspace(),
      transactions: [{ amountMinor: NaN }],
    }).success,
    false,
  );
  assert.throws(() => parseRecovery('invalid'));
});
