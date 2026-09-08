import { z } from 'zod';
export const envelopeSchema = z
  .object({
    encryptionVersion: z.literal(1),
    algorithm: z.literal('AES-256-GCM'),
    schemaVersion: z.union([z.literal(1), z.literal(2)]),
    iv: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
    ciphertext: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .min(22)
      .max(8 * 1024 * 1024),
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export function encode(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function decode(s: string) {
  return Uint8Array.from(
    atob(s.replaceAll('-', '+').replaceAll('_', '/')),
    (c) => c.charCodeAt(0),
  );
}
const text = new TextEncoder();
export async function deriveKeys(secret: Uint8Array, vaultId: string) {
  if (secret.length !== 32 || !/^\w{8}-[\w-]{27}$/.test(vaultId))
    throw new Error('Invalid recovery package');
  const master = await crypto.subtle.importKey(
    'raw',
    secret as BufferSource,
    'HKDF',
    false,
    ['deriveKey', 'deriveBits'],
  );
  const params = (purpose: string) => ({
    name: 'HKDF',
    hash: 'SHA-256',
    salt: text.encode('potok:v1:' + vaultId),
    info: text.encode(purpose),
  });
  const encryptionKey = await crypto.subtle.deriveKey(
    params('vault-encryption'),
    master,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const authSecret = encode(
    new Uint8Array(
      await crypto.subtle.deriveBits(params('vault-auth'), master, 256),
    ),
  );
  return { encryptionKey, authSecret };
}
function aad(vaultId: string, schemaVersion: number) {
  return text.encode(`potok|${vaultId}|1|AES-256-GCM|${schemaVersion}`);
}
export async function encrypt(
  data: unknown,
  key: CryptoKey,
  vaultId: string,
): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(vaultId, 2), tagLength: 128 },
    key,
    text.encode(JSON.stringify(data)),
  );
  return {
    encryptionVersion: 1,
    algorithm: 'AES-256-GCM',
    schemaVersion: 2,
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
}
export async function decrypt(
  envelope: unknown,
  key: CryptoKey,
  vaultId: string,
): Promise<unknown> {
  const e = envelopeSchema.parse(envelope);
  const bytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decode(e.iv),
      additionalData: aad(vaultId, e.schemaVersion),
      tagLength: 128,
    },
    key,
    decode(e.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function recoveryString(vaultId: string, secret: Uint8Array) {
  const hex = Array.from(secret, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return 'POTOK1:' + vaultId + ':' + hex.match(/.{4}/g)!.join('-');
}
export function parseRecovery(input: string) {
  const parts = input.trim().split(':');
  if (
    parts.length !== 3 ||
    parts[0] !== 'POTOK1' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      parts[1],
    )
  )
    throw new Error('Invalid recovery key');
  const hex = parts[2].replaceAll('-', '');
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error('Invalid recovery key');
  return {
    vaultId: parts[1],
    secret: Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16)),
  };
}
