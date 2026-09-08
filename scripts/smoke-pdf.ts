import assert from 'node:assert/strict';
import { makePdf, fixtureLines } from '../tests/pdf-fixture.ts';
const base = 'http://localhost:3000',
  headers = { Cookie: process.env.POTOK_TEST_COOKIE ?? '', Origin: base };
const name = 'PDF QA ' + Date.now();
const bytes = makePdf(fixtureLines(name));
let r = await fetch(base + '/api/imports', { headers });
const before = ((await r.json()) as unknown[]).length;
const form = new FormData();
form.set('file', new File([bytes as BlobPart], 'statement.pdf'));
form.set('currency', 'RUB');
r = await fetch(base + '/api/imports', { method: 'POST', headers, body: form });
const preview = (await r.json()) as {
  pdfPreview?: { rows: any[] };
  error?: string;
};
assert.equal(r.status, 200, JSON.stringify(preview));
assert.equal(preview.pdfPreview?.rows.length, 3);
r = await fetch(base + '/api/imports', { headers });
assert.equal(((await r.json()) as unknown[]).length, before);
form.set('pdfReviewed', 'true');
form.set('pdfRows', JSON.stringify(preview.pdfPreview!.rows));
r = await fetch(base + '/api/imports', { method: 'POST', headers, body: form });
const result = (await r.json()) as {
  transactionCount?: number;
  candidateCount?: number;
  error?: string;
};
assert.equal(r.status, 201, JSON.stringify(result));
assert.equal(result.transactionCount, 3);
assert.ok((result.candidateCount ?? 0) >= 1);
for (const route of [
  '/',
  '/import',
  '/detected',
  '/expenses',
  '/recommendations',
  '/settings',
  '/manifest.webmanifest',
  '/sw.js',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
]) {
  const r = await fetch(base + route, { headers });
  assert.equal(r.status, 200, route);
}
console.log(
  'PASS: PDF upload → editable preview without persistence → validated import → detection; all product/PWA routes respond',
);
process.exit(0);
