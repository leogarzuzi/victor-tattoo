// GET  /api/session → who is logged in, and whether the password must be changed
// POST /api/session → log in   { user, password }
// DELETE /api/session → log out
const { route, send, body } = require('./_lib/http');
const auth = require('./_lib/auth');
const storage = require('./_lib/storage');

module.exports = route(['GET', 'POST', 'DELETE'], async (req, res) => {
  if (req.method === 'DELETE') { auth.clearSession(res); return send(res, 200, { ok: true }); }
  if (req.method === 'POST') {
    const { user, password } = body(req);
    const result = await auth.login(user || '', password || '');
    if (!result) return send(res, 401, { error: 'Usuário ou senha incorretos.' });
    auth.createSession(res, result);
    return send(res, 200, { user: result.user, mustChange: result.mustChange });
  }
  const session = await auth.getSession(req);
  send(res, 200, { user: session?.user || null, mustChange: Boolean(session?.mustChange), storage: { readWrite: 'blob', oidc: 'blob-presigned', local: 'local' }[storage.mode()] });
});
