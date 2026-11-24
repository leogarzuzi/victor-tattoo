// Admin login: one account.
// ADMIN_USER and ADMIN_TEMP_PASSWORD (Vercel environment variables) define the first access.
// After logging in with the temporary password the owner must choose a personal one,
// stored only as a scrypt hash. Setting a new ADMIN_TEMP_PASSWORD on Vercel resets access.
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const storage = require('./storage');
const { parseCookies } = require('./http');

const scrypt = promisify(crypto.scrypt);
const COOKIE = 'vs_admin';
const SESSION_DAYS = 7;
const AUTH_PREFIX = 'admin/auth-';

function config() {
  const user = (process.env.ADMIN_USER || '').trim();
  const temp = process.env.ADMIN_TEMP_PASSWORD || '';
  const secret = process.env.SESSION_SECRET || '';
  if (!user || temp.length < 8 || secret.length < 32) {
    const error = new Error('O login do painel ainda não foi configurado na Vercel (ADMIN_USER, ADMIN_TEMP_PASSWORD e SESSION_SECRET).');
    error.status = 503;
    throw error;
  }
  return { user, temp, secret };
}

const hmac = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { salt, hash: key.toString('base64url') };
}

async function readAuth() {
  const { secret, temp } = config();
  const auth = await storage.readLatestJSON(AUTH_PREFIX);
  // The temporary password is in force when no personal password exists yet,
  // or when the temporary password on Vercel was changed after the last one was set.
  const tempActive = !auth || !safeEqual(auth.tempFingerprint, hmac(secret, `temp:${temp}`));
  return { auth, tempActive, version: auth?.version || 0 };
}

function createSession(res, { user, version, mustChange }) {
  const { secret } = config();
  const payload = Buffer.from(JSON.stringify({ u: user, v: version, m: mustChange, exp: Date.now() + SESSION_DAYS * 864e5 })).toString('base64url');
  const token = `${payload}.${hmac(secret, payload)}`;
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

function clearSession(res) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

// Returns the session or null. Sessions end when the password changes (version mismatch).
async function getSession(req) {
  const { secret, user } = config();
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, hmac(secret, payload))) return null;
  let session;
  try { session = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  if (session.u !== user || session.exp < Date.now()) return null;
  const { version, tempActive } = await readAuth();
  if (session.v !== version) return null;
  if (!session.m && tempActive) return null;
  return { user: session.u, mustChange: Boolean(session.m) };
}

async function requireSession(req, { allowMustChange = false } = {}) {
  const session = await getSession(req);
  if (!session || (session.mustChange && !allowMustChange)) {
    const error = new Error(session ? 'Troque a senha provisória para continuar.' : 'Faça login para continuar.');
    error.status = 401;
    throw error;
  }
  return session;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function login(user, password) {
  const cfg = config();
  const { auth, tempActive, version } = await readAuth();
  let ok = false;
  if (safeEqual(String(user).trim().toLowerCase(), cfg.user.toLowerCase())) {
    if (tempActive) ok = safeEqual(password, cfg.temp);
    else ok = safeEqual((await hashPassword(String(password), auth.salt)).hash, auth.hash);
  }
  if (!ok) { await wait(900); return null; }
  return { user: cfg.user, version, mustChange: tempActive };
}

function checkNewPassword(password) {
  const { temp } = config();
  if (typeof password !== 'string' || password.length < 8) return 'A nova senha precisa ter pelo menos 8 caracteres.';
  if (password.length > 200) return 'A nova senha é longa demais.';
  if (password === temp) return 'A nova senha não pode ser igual à provisória.';
  return null;
}

async function setPassword(password) {
  const { secret, temp } = config();
  const { version } = await readAuth();
  const { salt, hash } = await hashPassword(password);
  const next = version + 1;
  await storage.writeJSON(AUTH_PREFIX, { salt, hash, tempFingerprint: hmac(secret, `temp:${temp}`), version: next, updatedAt: new Date().toISOString() }, 2);
  return next;
}

async function verifyPassword(password) {
  const { auth, tempActive } = await readAuth();
  if (tempActive) return safeEqual(password, config().temp);
  return safeEqual((await hashPassword(String(password), auth.salt)).hash, auth.hash);
}

module.exports = { config, login, getSession, requireSession, createSession, clearSession, checkNewPassword, setPassword, verifyPassword };
