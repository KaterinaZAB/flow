import { createRequire } from 'node:module';
import { resolve } from 'node:path';
type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
type Pool = {
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
};
type Driver = { Pool: new (options: Record<string, unknown>) => Pool };
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
