// Small helpers shared by the API routes.
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return cookies;
}

// Requests that change data must come from this same site.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

// Wraps a handler: method check, origin check for writes and friendly errors.
function route(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return send(res, 405, { error: 'Método não permitido.' });
    if (req.method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Origem não permitida.' });
    try { await require('./storage').withRequest(req, () => handler(req, res)); }
    catch (error) {
      console.error(error);
      send(res, error.status || 500, { error: error.status ? error.message : 'Erro no servidor. Tente de novo em instantes.' });
    }
  };
}

module.exports = { send, parseCookies, body, route };
