import { services } from '@/lib/domain/catalog';
export function GET() {
  return Response.json(
    {
      version: 1,
      periods: ['weekly', 'monthly', 'quarterly', 'yearly'],
      merchants: services.map((s) => ({
        serviceId: s.id,
        aliases: s.merchantAliases,
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
