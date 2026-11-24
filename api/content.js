// GET  /api/content            → published content as JSON (null until the first publish)
// GET  /api/content?format=js  → the same, as a script that sets window.SITE_CONTENT for the public pages
// PUT  /api/content            → publish (admin only)
const { route, send, body } = require('./_lib/http');
const { requireSession } = require('./_lib/auth');
const content = require('./_lib/content');

module.exports = route(['GET', 'PUT'], async (req, res) => {
  if (req.method === 'PUT') {
    await requireSession(req);
    const saved = await content.save(body(req).content);
    return send(res, 200, { ok: true, content: saved });
  }
  const format = new URL(req.url, 'http://x').searchParams.get('format');
  let data = null;
  try { data = await content.read(); }
  catch (error) { if (format !== 'js') throw error; console.error(error); }
  if (format === 'js') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    // Browsers always ask again; Vercel's CDN keeps a copy for a few seconds,
    // so published changes reach visitors within about a minute.
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Vercel-CDN-Cache-Control', 'max-age=15, stale-while-revalidate=60');
    return res.end(`window.SITE_CONTENT = ${JSON.stringify(data).replace(/</g, '\\u003c')};`);
  }
  send(res, 200, { content: data });
});
