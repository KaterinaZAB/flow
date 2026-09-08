import { randomUUID, randomBytes } from 'node:crypto';
import { createRateLimiter } from './rate-limit.mjs';
const origin = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000');
if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
  throw new Error('Production APP_ORIGIN must use HTTPS');
process.env.VINEXT_TRUSTED_HOSTS = origin.host;
process.env.VINEXT_TRUST_PROXY = '1';
const { startProdServer } = await import('vinext/server/prod-server');
const { server } = await startProdServer({
  port: Number(process.env.PORT ?? 3000),
  host: '0.0.0.0',
});
const handlers = server.listeners('request');
server.removeAllListeners('request');
const apiLimit = createRateLimiter({ limit: 180, windowMs: 60000 });
const createLimit = createRateLimiter({ limit: 5, windowMs: 3600000 });
server.on('request', (req, res) => {
  const nonce = randomBytes(24).toString('base64');
  const policy =
    "default-src 'self'; script-src 'self' 'nonce-" +
    nonce +
    "'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  req.headers['content-security-policy'] = policy;
  res.setHeader('Content-Security-Policy', policy);
  const id = randomUUID(),
    started = performance.now();
  const path = (req.url ?? '/').split('?')[0];
  res.setHeader('X-Request-Id', id);
  res.on('finish', () =>
    console.log(
      JSON.stringify({
        requestId: id,
        method: req.method,
        // Paths can contain entity IDs. Never log queries, cookies or payloads.
        path: path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id'),
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    ),
  );
  const fail = (status, message) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ error: message, code: `HTTP_${status}` }));
  };
  const remote = String(
    req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? 'unknown',
  );
  if (path.startsWith('/api/')) {
    const limits = [apiLimit(remote)];
    if (path === '/api/vaults' && req.method === 'POST')
      limits.push(createLimit(remote));
    const denied = limits.find((result) => !result.allowed);
    if (denied) {
      res.setHeader('Retry-After', String(denied.retryAfter));
      return fail(429, 'Слишком много запросов. Повторите позже.');
    }
    if (Number(req.headers['content-length'] ?? 0) > 9 * 1024 * 1024)
      return fail(413, 'Файл слишком большой.');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin !== origin.origin
    )
      return fail(403, 'Запрос должен быть отправлен из приложения.');
  }
  for (const handler of handlers) handler.call(server, req, res);
});
server.requestTimeout = 120000;
server.headersTimeout = 15000;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 25000);
  timeout.unref();
  server.closeIdleConnections();
  await new Promise((resolve) => server.close(resolve));
  await globalThis[Symbol.for('potok.closeDatabase')]?.();
  clearTimeout(timeout);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
