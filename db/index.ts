import { drizzle } from 'drizzle-orm/node-postgres';
import { databasePool } from '../lib/server/postgres';
import * as schema from './schema';
export function getDb() {
  return drizzle(databasePool(), { schema });
}
