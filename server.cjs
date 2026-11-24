// Local server: the site, the admin API (/api/*) and files uploaded in local mode (/local-blob/*).
// Optional settings for the admin go in .env.local (see .env.example).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT) || 3000;

try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch {}

const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.otf': 'font/otf', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.svg': 'image/svg+xml' };
const routes = new Set(['content', 'session', 'password', 'upload']);
const blobRoot = path.join(root, '.local-data', 'blobs');

// Gives local API handlers the same req.body / res helpers they get on Vercel.
async function runApi(name, req, res) {
  if ((req.headers['content-type'] || '').startsWith('application/json')) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
  }
  require(`./api/${name}.js`)(req, res);
}

function serveFile(req, res, file) {
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = match && match[1] ? Number(match[1]) : 0;
      let end = match && match[2] ? Number(match[2]) : stat.size - 1;
      if (match && !match[1] && match[2]) { start = Math.max(0, stat.size - Number(match[2])); end = stat.size - 1; }
      end = Math.min(end, stat.size - 1);
      if (!match || start > end || start >= stat.size) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    }
  });
}

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  const api = /^\/api\/([a-z]+)$/.exec(pathname);
  if (api) {
    if (!routes.has(api[1])) { res.writeHead(404); return res.end(); }
    return runApi(api[1], req, res).catch(error => { console.error(error); res.writeHead(500); res.end(); });
  }
  if (pathname.startsWith('/local-blob/')) {
    const file = path.resolve(blobRoot, '.' + pathname.slice('/local-blob'.length));
    if (!file.startsWith(blobRoot + path.sep)) { res.writeHead(403); return res.end(); }
    return serveFile(req, res, file);
  }
  if (pathname === '/admin') pathname = '/admin.html';
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, file).split(path.sep);
  // Never serve hidden files (.env.local, .local-data), dependencies or server code.
  if (!file.startsWith(root + path.sep) || relative.some(part => part.startsWith('.')) || ['node_modules', 'api', 'scripts'].includes(relative[0])) { res.writeHead(403); return res.end(); }
  serveFile(req, res, file);
}).listen(port, '127.0.0.1', () => console.log(`Local: http://localhost:${port}`));
