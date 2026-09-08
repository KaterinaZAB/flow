import { databasePool } from '@/lib/server/postgres';
export async function GET() {
  try {
    const r = await databasePool().query(
      'SELECT metadata FROM services ORDER BY id',
    );
    return Response.json(
      r.rows.map((row) => JSON.parse(String(row.metadata))),
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch {
    return Response.json(
      { error: 'Каталог временно недоступен.' },
      { status: 503 },
    );
  }
}
