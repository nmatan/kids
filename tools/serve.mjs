/* ---------------------------------------------------------------
   serve.mjs — local dev server.  Run:  npm start

   http://localhost:8080 counts as a "secure context", so the service
   worker and PWA install prompt work here just like on the real site.
   The LAN address does NOT get a service worker (browsers require
   HTTPS for that) — it's fine for a quick look on the tablet, but for
   a real install use the GitHub Pages URL. See README.
   --------------------------------------------------------------- */

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // normalize + the startsWith check keeps `../` out of the served tree
  let path = normalize(join(ROOT, url === '/' ? '/index.html' : url));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(path)] || 'application/octet-stream',
    // never cache during development, or you'll debug yesterday's code
    'cache-control': 'no-store',
  });
  createReadStream(path).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);

  console.log(`\n  Learning Games\n`);
  console.log(`  local:  http://localhost:${PORT}   ← full PWA behaviour`);
  lan.forEach((ip) => console.log(`  lan:    http://${ip}:${PORT}   ← quick tablet preview`));
  console.log(`\n  Ctrl+C to stop\n`);
});
