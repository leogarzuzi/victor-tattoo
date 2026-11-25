// Storage for the admin area.
// On Vercel it uses Vercel Blob. New stores connect through OIDC (BLOB_STORE_ID, with a
// per-request token in the x-vercel-oidc-token header); older ones through BLOB_READ_WRITE_TOKEN.
// On a local machine without either it falls back to the .local-data folder (`npm run dev`).
const fs = require('node:fs/promises');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');

// The request being handled, so Blob calls can use its OIDC token.
const requestContext = new AsyncLocalStorage();
const withRequest = (req, fn) => requestContext.run(req, fn);

const LOCAL_ROOT = path.join(__dirname, '..', '..', '.local-data', 'blobs');
// Vercel names the variable BLOB_READ_WRITE_TOKEN, or <PREFIX>_READ_WRITE_TOKEN when the store
// was connected with a custom prefix; Blob tokens always start with vercel_blob_rw_.
function token() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find(name => /READ_WRITE_TOKEN$/.test(name) && String(process.env[name]).startsWith('vercel_blob_rw_'));
  return key ? process.env[key] : '';
}
const storeId = () => (process.env.BLOB_STORE_ID || '').trim();
// 'readWrite' (classic token), 'oidc' (store connected the new way) or 'local'.
const mode = () => (token() ? 'readWrite' : storeId() ? 'oidc' : 'local');
const isLocal = () => mode() === 'local';

// Credentials for every Blob SDK call.
function auth() {
  if (mode() === 'readWrite') return { token: token() };
  const req = requestContext.getStore();
  const oidcToken = req?.headers?.['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  return { storeId: storeId(), ...(oidcToken ? { oidcToken } : {}) };
}

function assertConfigured() {
  if (isLocal() && process.env.VERCEL) {
    const error = new Error('O armazenamento (Vercel Blob) ainda não foi conectado a este projeto.');
    error.status = 503;
    throw error;
  }
}

let blobModule;
const blob = () => (blobModule ||= require('@vercel/blob'));

function safeLocalPath(pathname) {
  const file = path.resolve(LOCAL_ROOT, pathname);
  if (!file.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Caminho inválido.');
  return file;
}

async function walk(dir) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const files = await Promise.all(entries.map(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  }));
  return files.flat();
}

// Lists stored files whose path starts with prefix: [{ url, pathname, uploadedAt }].
async function list(prefix) {
  assertConfigured();
  if (isLocal()) {
    const files = await walk(LOCAL_ROOT);
    const result = [];
    for (const file of files) {
      const pathname = path.relative(LOCAL_ROOT, file).split(path.sep).join('/');
      if (!pathname.startsWith(prefix)) continue;
      const stat = await fs.stat(file);
      result.push({ url: `/local-blob/${pathname}`, pathname, uploadedAt: stat.mtime });
    }
    return result;
  }
  const result = [];
  let cursor;
  do {
    const page = await blob().list({ prefix, cursor, limit: 1000, ...auth() });
    result.push(...page.blobs.map(item => ({ url: item.url, pathname: item.pathname, uploadedAt: new Date(item.uploadedAt) })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return result;
}

async function put(pathname, body, contentType) {
  assertConfigured();
  if (isLocal()) {
    const file = safeLocalPath(pathname);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return { url: `/local-blob/${pathname}`, pathname };
  }
  const result = await blob().put(pathname, body, { access: 'public', addRandomSuffix: true, contentType, cacheControlMaxAge: 60 * 60 * 24 * 365, ...auth() });
  return { url: result.url, pathname: result.pathname };
}

async function remove(items) {
  if (!items.length) return;
  assertConfigured();
  if (isLocal()) {
    await Promise.all(items.map(item => fs.rm(safeLocalPath(item.pathname), { force: true })));
    return;
  }
  for (let i = 0; i < items.length; i += 100) await blob().del(items.slice(i, i + 100).map(item => item.url), auth());
}

async function readFile(item) {
  if (isLocal()) return fs.readFile(safeLocalPath(item.pathname), 'utf8');
  const response = await fetch(item.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao ler ${item.pathname}`);
  return response.text();
}

// JSON documents are stored as versioned files (prefix + timestamp) so every save gets a fresh URL
// and no cache can serve an old copy. The newest file wins; a few older ones stay as backup.
const stamp = () => String(Date.now()).padStart(15, '0');

async function readLatestJSON(prefix) {
  const files = (await list(prefix)).sort((a, b) => a.pathname.localeCompare(b.pathname));
  const latest = files[files.length - 1];
  return latest ? JSON.parse(await readFile(latest)) : null;
}

async function writeJSON(prefix, data, keep = 3) {
  await put(`${prefix}${stamp()}.json`, JSON.stringify(data), 'application/json');
  const files = (await list(prefix)).sort((a, b) => a.pathname.localeCompare(b.pathname));
  await remove(files.slice(0, Math.max(0, files.length - keep)));
}

module.exports = { token, mode, auth, withRequest, isLocal, list, put, remove, readLatestJSON, writeJSON, LOCAL_ROOT, safeLocalPath };
