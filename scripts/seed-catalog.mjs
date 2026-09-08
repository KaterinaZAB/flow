import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { services } from '../lib/domain/catalog.ts';
const { Client } = createRequire(resolve('backend/package.json'))('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  for (const service of services) {
    await client.query(
      'INSERT INTO services(id,name,category,metadata) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,metadata=excluded.metadata',
      [service.id, service.name, service.category, JSON.stringify(service)],
    );
    await client.query('DELETE FROM service_aliases WHERE service_id=$1', [
      service.id,
    ]);
    for (const [index, alias] of service.merchantAliases.entries())
      await client.query(
        'INSERT INTO service_aliases(id,service_id,alias) VALUES($1,$2,$3)',
        [service.id + ':' + index, service.id, alias],
      );
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
