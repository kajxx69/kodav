/* global process, URL */
// Sert le build statique du front comme un hébergeur : fichier, dossier/index.html,
// sinon __spa-fallback.html (pages non pré-rendues, espaces connectés).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '../client/build/client');
const port = Number(process.env.E2E_WEB_PORT ?? 5180);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.data': 'text/x-script',
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const file =
      [path.join(root, pathname), path.join(root, pathname, 'index.html')].find(
        (f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile(),
      ) ?? path.join(root, '__spa-fallback.html');
    const type = types[path.extname(file)] ?? 'application/octet-stream';
    // Compression comme chez les hébergeurs (mesures de performance réalistes).
    const compress = /text|javascript|json|svg|xml/.test(type);
    const cache = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': cache,
      ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
    });
    const stream = fs.createReadStream(file);
    if (compress) stream.pipe(zlib.createGzip()).pipe(res);
    else stream.pipe(res);
  })
  .listen(port);
