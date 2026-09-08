import { readdir, writeFile } from 'node:fs/promises';
const assets = [];
async function walk(dir, url) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    if (f.isDirectory()) await walk(dir + '/' + f.name, url + '/' + f.name);
    else if (/\.(js|css|woff2?|png|svg)$/.test(f.name))
      assets.push(url + '/' + f.name);
  }
}
await walk('dist/client/_next', '/_next');
await writeFile(
  'dist/client/_next/static/offline-assets.json',
  JSON.stringify(assets),
);

const { readFile } = await import('node:fs/promises');
const { createHash } = await import('node:crypto');
const worker = await readFile('public/sw.js', 'utf8');
await writeFile(
  'dist/client/sw.js',
  worker.replace(
    'potok-local-shell-v2',
    'potok-local-shell-' +
      createHash('sha256')
        .update(JSON.stringify(assets))
        .digest('hex')
        .slice(0, 12),
  ),
);
