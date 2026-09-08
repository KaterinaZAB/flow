export function GET() {
  return Response.json(
    { version: 1, algorithmVersion: 1 },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
