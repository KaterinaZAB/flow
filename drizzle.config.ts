import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/vault-generated',
  schema: './db/schema.ts',
  dialect: 'postgresql',
});

