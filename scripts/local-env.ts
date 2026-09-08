/** Development-only D1 adapter for Windows, excluded from Worker builds. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
mkdirSync(resolve('.local'), { recursive: true });
const sqlite = new DatabaseSync(resolve('.local/potok.sqlite'));
sqlite.exec(
  'PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)',
);
for (const name of readdirSync(resolve('drizzle'))
  .filter((n) => n.endsWith('.sql'))
  .sort()) {
  if (
    !sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)
  ) {
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(readFileSync(resolve('drizzle', name), 'utf8'));
      sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  }
}
class Stmt {
  constructor(
    public sql: string,
    public values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Stmt(this.sql, values);
  }
  async all<T>() {
    return {
      results: sqlite.prepare(this.sql).all(...(this.values as never[])) as T[],
    };
  }
  async first<T>() {
    return (sqlite.prepare(this.sql).get(...(this.values as never[])) ??
      null) as T | null;
  }
  async run() {
    return sqlite.prepare(this.sql).run(...(this.values as never[]));
  }
}
export const env = {
  ...Object.fromEntries(
    [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'APP_ORIGIN',
      'OAUTH_TOKEN_ENCRYPTION_KEY',
    ].map((key) => [key, process.env[key]]),
  ),
  DB: {
    prepare: (sql: string) => new Stmt(sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const st of stmts) {
          result.push(await st.run());
        }
        sqlite.exec('COMMIT');
        return result;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  },
};
