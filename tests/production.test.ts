import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MIGRATIONS_DIRECTORY } from '../scripts/migration-path.mjs';
import { createRateLimiter } from '../scripts/rate-limit.mjs';
test('backend runtime has no cyclic dependency on the repository', () => {
  const manifest = JSON.parse(readFileSync('backend/package.json', 'utf8'));
  assert.equal(manifest.dependencies.potok, undefined);
  const lock = JSON.parse(readFileSync('backend/package-lock.json', 'utf8'));
  assert.equal(lock.packages['..'], undefined);
  assert.equal(lock.packages['node_modules/potok'], undefined);
});
test('Drizzle journal and production SQL share the canonical directory', () => {
  for (const file of ['drizzle.config.ts', 'scripts/migrate.mjs'])
    assert.match(readFileSync(file, 'utf8'), /MIGRATIONS_DIRECTORY/);
  const journal = JSON.parse(
    readFileSync(`${MIGRATIONS_DIRECTORY}/meta/_journal.json`, 'utf8'),
  );
  assert.deepEqual(
    journal.entries.map((e: { tag: string }) => e.tag + '.sql').sort(),
    readdirSync(MIGRATIONS_DIRECTORY)
      .filter((f) => f.endsWith('.sql'))
      .sort(),
  );
});
test('vault creation limiter caps requests, expires windows and bounds memory', () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 1000, maxKeys: 1 });
  assert.equal(allow('one', 0).allowed, true);
  assert.equal(allow('one', 1).allowed, true);
  assert.equal(allow('one', 2).allowed, false);
  assert.equal(allow('two', 2).allowed, false);
  assert.equal(allow('two', 1000).allowed, true);
});
test('PDF review uses progressive disclosure and keeps detection primary', () => {
  const source = readFileSync('components/product/pdf-review.tsx', 'utf8');
  assert.match(source, /showRows &&/);
  assert.match(source, /Найти регулярные расходы/);
  assert.match(source, /Посмотреть распознанные операции/);
  assert.match(
    source,
    /сомнительные строки[\s\S]*не будем учитывать[\s\S]*автоматически/,
  );
});
