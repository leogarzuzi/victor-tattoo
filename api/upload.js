// POST /api/upload
// On Vercel: hands the browser a short-lived token to send the file straight to Vercel Blob
// (this skips the 4.5 MB limit of serverless functions, so videos fit).
// Locally: receives the file itself and stores it in .local-data.
const { route, send, body } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const storage = require('./_lib/storage');

const TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
const MAX_BYTES = 100 * 1024 * 1024;
const validPath = pathname => /^media\/[\w\-.]+$/.test(pathname) && !pathname.includes('..');

async function readRaw(req, limit) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) { const error = new Error('Arquivo grande demais (máximo 100 MB).'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const handler = route(['POST'], async (req, res) => {
  if (storage.isLocal() && !process.env.VERCEL) {
    await requireSession(req);
    const params = new URL(req.url, 'http://x').searchParams;
    const pathname = params.get('pathname') || '';
    const type = String(req.headers['content-type'] || '').split(';')[0];
    if (!validPath(pathname) || !TYPES[type]) return send(res, 400, { error: 'Tipo de arquivo não aceito.' });
    const saved = await storage.put(pathname, await readRaw(req, MAX_BYTES), type);
    return send(res, 200, saved);
  }
  const { handleUpload } = require('@vercel/blob/client');
  const payload = body(req);
  // Only the token request comes from the browser; it must carry an admin session.
  if (payload.type === 'blob.generate-client-token') await requireSession(req);
  const result = await handleUpload({
    body: payload,
    request: req,
    onBeforeGenerateToken: async pathname => {
      if (!validPath(pathname)) { const error = new Error('Nome de arquivo inválido.'); error.status = 400; throw error; }
      return { allowedContentTypes: Object.keys(TYPES), maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true, cacheControlMaxAge: 60 * 60 * 24 * 365 };
    },
  });
  send(res, 200, result);
});

module.exports = handler;
