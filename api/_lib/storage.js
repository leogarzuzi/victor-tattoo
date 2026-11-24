// Storage for the admin area.
// On Vercel it uses Vercel Blob (BLOB_READ_WRITE_TOKEN). On a local machine without a token
// it falls back to the .local-data folder, so the admin can be tried with `npm run dev`.
const fs = require('node:fs/promises');
const path = require('node:path');

const LOCAL_ROOT = path.join(__dirname, '..', '..', '.local-data', 'blobs');
const isLocal = () => !process.env.BLOB_READ_WRITE_TOKEN;

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
    const page = await blob().list({ prefix, cursor, limit: 1000 });
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
  const result = await blob().put(pathname, body, { access: 'public', addRandomSuffix: true, contentType, cacheControlMaxAge: 60 * 60 * 24 * 365 });
  return { url: result.url, pathname: result.pathname };
}

async function remove(items) {
  if (!items.length) return;
  assertConfigured();
  if (isLocal()) {
    await Promise.all(items.map(item => fs.rm(safeLocalPath(item.pathname), { force: true })));
    return;
  }
  for (let i = 0; i < items.length; i += 100) await blob().del(items.slice(i, i + 100).map(item => item.url));
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

module.exports = { isLocal, list, put, remove, readLatestJSON, writeJSON, LOCAL_ROOT, safeLocalPath };
