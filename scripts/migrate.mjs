import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { MIGRATIONS_DIRECTORY } from './migration-path.mjs';
const { Client } = createRequire(resolve('backend/package.json'))('pg');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('SELECT pg_advisory_lock(71834620)');
  const legacy = await client.query(
    "SELECT to_regclass('public.users') AS legacy",
  );
  if (legacy.rows[0].legacy)
    throw new Error(
      'Legacy database detected. Export old data and use a NEW database for vault architecture. No data was deleted.',
    );
  await client.query(
    'CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const directory = resolve(MIGRATIONS_DIRECTORY);
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const content = await readFile(resolve(directory, name), 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    const applied = await client.query(
      'SELECT checksum FROM app_migrations WHERE name=$1',
      [name],
    );
    if (applied.rows.length) {
      if (applied.rows[0].checksum !== checksum)
        throw new Error('Migration checksum mismatch: ' + name);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(content);
      await client.query(
        'INSERT INTO app_migrations(name,checksum) VALUES($1,$2)',
        [name, checksum],
      );
      await client.query('COMMIT');
      console.log(JSON.stringify({ event: 'migration_applied', name }));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
