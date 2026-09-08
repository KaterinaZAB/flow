import { NextResponse } from 'next/server';
export function middleware() {
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  return response;
}
export const config = {
  matcher: [
    '/',
    '/expenses/:path*',
    '/import',
    '/detected',
    '/recommendations',
    '/settings',
    '/api/:path*',
  ],
};
