import { env } from './runtime';
export type Statement = {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type Database = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
};
export function db(): Database {
  const database = (env as unknown as { DB?: Database }).DB;
  if (!database) throw new Error('Database binding unavailable');
  return database;
}
export function camelRow<T>(row: Record<string, unknown>): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ]),
  ) as T;
}
