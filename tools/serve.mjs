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
import { spawn } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > -1 && process.argv[portArg + 1]) || Number(process.env.PORT) || 8080;

/** Open the default browser. Called once the server is actually listening,
    so there's no race between the browser and the port being ready. */
function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch { /* no browser to open — the URL is printed below anyway */ }
}

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

const server = createServer((req, res) => {
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
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error('  A server is probably still running in another window.');
    console.error('  Close it, or run:  npm start -- --port 8081\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);

  const url = `http://localhost:${PORT}`;
  // ASCII only: the Windows console can't render Hebrew and shows mojibake.
  console.log(`\n  Learning Games - dev server\n`);
  console.log(`  local:  ${url}   <- full PWA behaviour`);
  lan.forEach((ip) => console.log(`  lan:    http://${ip}:${PORT}   <- quick tablet preview`));
  console.log(`\n  Edit a file, then just refresh the browser.`);
  console.log(`  Ctrl+C to stop.\n`);

  if (process.argv.includes('--open')) openBrowser(url);
});
