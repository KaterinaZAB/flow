import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { Database, Statement } from './db';

// The driver is a server-only deployment dependency (backend/package.json).
type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type Client = {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
};
type Pool = {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  connect(): Promise<Client>;
  end(): Promise<void>;
};
type Driver = { Pool: new (options: Record<string, unknown>) => Pool };

function decode(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (
        typeof value === 'string' &&
        /^(amount_minor|expires_at|lock_until|n)$/.test(key)
      ) {
        const number = Number(value);
        if (!Number.isSafeInteger(number))
          throw new Error('Unsafe database integer');
        return [key, number];
      }
      return [key, value];
    }),
  );
}
let pool: Pool | undefined;
export function databasePool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!pool) {
    const { Pool } = createRequire(resolve('backend/package.json'))(
      'pg',
    ) as Driver;
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 30000,
    });
  }
  return pool;
}
export async function closeDatabase() {
  await pool?.end();
  pool = undefined;
}
// The bundled RSC module and Node launcher share this shutdown hook.
Object.defineProperty(globalThis, Symbol.for('potok.closeDatabase'), {
  value: closeDatabase,
  configurable: true,
});

/** Preserve repository queries while adapting their parameterized SQL dialect. */
export function postgresSQL(query: string) {
  const ignore = /INSERT OR IGNORE/i.test(query);
  let sql = query.replace(/INSERT OR IGNORE/gi, 'INSERT');
  sql = sql.replace(
    /json_extract\((\w+\.payload),'\$\.(\w+)'\)/g,
    "($1::jsonb ->> '$2')",
  );
  let index = 0;
  sql = sql.replace(/'(?:''|[^'])*'|\?/g, (token) =>
    token === '?' ? `$${++index}` : token,
  );
  if (ignore) sql += ' ON CONFLICT DO NOTHING';
  return sql;
}
class PgStatement implements Statement {
  constructor(
    readonly sql: string,
    readonly values: unknown[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new PgStatement(this.sql, values);
  }
  async all<T = Record<string, unknown>>() {
    const result = await databasePool().query(
      postgresSQL(this.sql),
      this.values,
    );
    return { results: result.rows.map(decode) as T[] };
  }
  async first<T = Record<string, unknown>>() {
    return (await this.all<T>()).results[0] ?? null;
  }
  async run() {
    return databasePool().query(postgresSQL(this.sql), this.values);
  }
}
export const postgres: Database = {
  prepare: (sql) => new PgStatement(sql),
  async batch(statements) {
    const client = await databasePool().connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const statement of statements) {
        if (!(statement instanceof PgStatement))
          throw new Error('Invalid statement');
        results.push(
          await client.query(postgresSQL(statement.sql), statement.values),
        );
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
