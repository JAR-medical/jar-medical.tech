// A static file server that serves the repo root the way GitHub Pages does.
//
// Pages ships this repository verbatim, so the end-to-end suite must drive the
// real files and nothing else: no bundler, no rewrites, no fallback to
// index.html. Directory requests resolve to index.html inside the directory,
// everything else is a 404 - the same behaviour a broken link would hit in
// production.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/repo.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Resolve a URL path to a file inside the repo, or null if it escapes or is missing. */
export function resolveRequest(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null; // malformed percent-encoding
  }
  const rel = decoded.replace(/^\/+/, '');
  const target = path.resolve(ROOT, rel);
  // Never serve anything outside the repo, whatever the request contains.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  if (!fs.existsSync(target)) return null;
  if (fs.statSync(target).isDirectory()) {
    const index = path.join(target, 'index.html');
    return fs.existsSync(index) ? index : null;
  }
  return target;
}

/**
 * Start the server on 127.0.0.1 with an ephemeral port.
 * Resolves to { url, port, close } - `close` always resolves, even on error.
 */
export function startServer() {
  const server = http.createServer((req, res) => {
    const file = resolveRequest(req.url || '/');
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`404 ${req.url}`);
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    fs.createReadStream(file)
      .on('error', () => { res.destroy(); })
      .pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
