import { databasePool } from '@/lib/server/postgres';
export async function GET() {
  try {
    await databasePool().query('SELECT 1 AS alive');
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
