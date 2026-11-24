// POST /api/password → change the password { current, password }
// Right after logging in with the temporary password, `current` is not asked again.
const { route, send, body } = require('./_lib/http');
const auth = require('./_lib/auth');

module.exports = route(['POST'], async (req, res) => {
  const session = await auth.requireSession(req, { allowMustChange: true });
  const { current, password } = body(req);
  if (!session.mustChange && !(await auth.verifyPassword(current || ''))) return send(res, 400, { error: 'A senha atual está incorreta.' });
  const problem = auth.checkNewPassword(password);
  if (problem) return send(res, 400, { error: problem });
  const version = await auth.setPassword(password);
  auth.createSession(res, { user: session.user, version, mustChange: false });
  send(res, 200, { ok: true });
});
