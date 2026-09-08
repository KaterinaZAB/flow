import { defineConfig } from 'drizzle-kit';
import { MIGRATIONS_DIRECTORY } from './scripts/migration-path.mjs';

export default defineConfig({
  out: MIGRATIONS_DIRECTORY,
  schema: './db/schema.ts',
  dialect: 'postgresql',
});
