import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const cjsModule = { exports: {} as { postgresSQL: (query: string) => string } };
runInNewContext(
  ts.transpileModule(readFileSync('lib/server/postgres.ts', 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { require, module: cjsModule, exports: cjsModule.exports, process },
);
const { postgresSQL } = cjsModule.exports;

test('PostgreSQL parameters never interpolate values or replace question marks in literals', () => {
  assert.equal(
    postgresSQL("SELECT '?' AS hint, name FROM users WHERE id=? AND email=?"),
    "SELECT '?' AS hint, name FROM users WHERE id=$1 AND email=$2",
  );
  assert.equal(
    postgresSQL("SELECT 'it''s ?' WHERE id=?"),
    "SELECT 'it''s ?' WHERE id=$1",
  );
});
test('SQLite compatibility preserves conflict handling and JSON null semantics in PostgreSQL', () => {
  assert.equal(
    postgresSQL('INSERT OR IGNORE INTO users(id,created_at) VALUES (?,?)'),
    'INSERT INTO users(id,created_at) VALUES ($1,$2) ON CONFLICT DO NOTHING',
  );
  assert.equal(
    postgresSQL(
      "SELECT json_extract(g.payload,'$.status') FROM gmail_receipts g WHERE g.user_id=?",
    ),
    "SELECT (g.payload::jsonb ->> 'status') FROM gmail_receipts g WHERE g.user_id=$1",
  );
});
