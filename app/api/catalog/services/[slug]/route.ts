import { databasePool } from '@/lib/server/postgres';
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    if (!/^[a-z0-9-]{1,100}$/.test(slug))
      return Response.json({ error: 'Сервис не найден.' }, { status: 404 });
    const r = await databasePool().query(
      'SELECT metadata FROM services WHERE id=$1',
      [slug],
    );
    if (!r.rows.length)
      return Response.json({ error: 'Сервис не найден.' }, { status: 404 });
    return Response.json(JSON.parse(String(r.rows[0].metadata)), {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return Response.json(
      { error: 'Каталог временно недоступен.' },
      { status: 503 },
    );
  }
}
