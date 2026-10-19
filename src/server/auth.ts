import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';

const COOKIE = 'reev_session';
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export function sameSecret(a: string, b: string) {
  return crypto.timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
}
export function atomicJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
function checkPassword(password: unknown, stored: string) {
  if (typeof password !== 'string' || password.length > 1024) return false;
  const salt = stored.split(':')[0];
  return sameSecret(hashPassword(password, salt), stored);
}
type AuthState = { username: string; passwordHash: string; sessions: Record<string, number> };
export function installAuth(app: Express, dataDir: string) {
  const keyFile = path.join(dataDir, 'integration_key.json');
  const envKey = process.env.GATEWAY_API_KEY?.trim();
  let apiKey = envKey || (fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, 'utf8')).key : '');
  if (!apiKey) { apiKey = 'reev_live_' + crypto.randomBytes(32).toString('hex'); atomicJson(keyFile, { key: apiKey }); }
  const file = path.join(dataDir, 'admin_auth.json');
  let state: AuthState;
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (typeof saved.username !== 'string' || (!saved.passwordHash && typeof saved.password !== 'string')) {
      throw new Error('File admin_auth.json tidak valid; pulihkan backup. Tidak menggunakan password default.');
    }
    state = { username: saved.username, passwordHash: saved.passwordHash || hashPassword(saved.password), sessions: saved.sessions || {} };
  } else {
    const password = process.env.ADMIN_PASSWORD;
    if (!password || password.length < 8) throw new Error('Isi ADMIN_PASSWORD (minimal 8 karakter) di .env sebelum menjalankan backend.');
    state = { username: process.env.ADMIN_USERNAME || 'admin', passwordHash: hashPassword(password), sessions: {} };
  }
  // Also migrates legacy plaintext credentials, and checks writable persistent storage at startup.
  atomicJson(file, state);
  const ttlDays = Number(process.env.SESSION_TTL_DAYS || 7);
  if (!Number.isFinite(ttlDays) || ttlDays < 1 || ttlDays > 90) throw new Error('SESSION_TTL_DAYS harus 1–90.');
  const ttl = ttlDays * 86400000;
  const cookieOptions = { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax' as const, path: '/' };
  const getToken = (req: Request) => {
    const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
    return cookie?.slice(COOKIE.length + 1) || '';
  };
  const authenticated = (req: Request) => (state.sessions[digest(getToken(req))] || 0) > Date.now();
  const commit = (next: AuthState) => { atomicJson(file, next); state = next; };
  const issue = (next: AuthState, res: Response) => {
    const token = crypto.randomBytes(32).toString('hex');
    next.sessions = Object.fromEntries(Object.entries(next.sessions).filter(([, expires]) => expires > Date.now()));
    // Keep at most 20 active administrator sessions.
    const retained = Object.entries(next.sessions).sort((a, b) => b[1] - a[1]).slice(0, 19);
    next.sessions = { ...Object.fromEntries(retained), [digest(token)]: Date.now() + ttl };
    commit(next);
    res.cookie(COOKIE, token, { ...cookieOptions, maxAge: ttl });
  };
  app.get('/api/health', (_req, res) => res.json({ success: true, service: 'reev-backend', version: '2.8.0' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const bridge = process.env.BACKEND_SHARED_SECRET;
    if (bridge && !sameSecret(req.get('x-reev-proxy-secret') || '', bridge)) {
      return res.status(403).json({ success: false, error: 'Akses backend harus melalui proxy yang dikonfigurasi.' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('sec-fetch-site') === 'cross-site' || !req.is('application/json')) {
        return res.status(403).json({ success: false, error: 'Permintaan harus berasal dari aplikasi dan memakai JSON.' });
      }
    }
    next();
  });
  let attempts = 0;
  let resetAt = 0;
  app.post('/api/auth/login', (req, res) => {
    // Global single-admin limiter; client-controlled proxy/IP headers cannot bypass it.
    if (Date.now() > resetAt) { attempts = 0; resetAt = Date.now() + 60000; }
    if (++attempts > 20) return res.status(429).json({ success: false, error: 'Terlalu banyak percobaan. Tunggu satu menit.' });
    const { username, password } = req.body || {};
    const correct = checkPassword(password, state.passwordHash);
    if (!correct || username !== state.username) return res.status(401).json({ success: false, error: 'Username atau password salah.' });
    issue({ ...state, sessions: { ...state.sessions } }, res);
    res.json({ success: true, user: { username: state.username, role: 'admin' } });
  });
  app.use('/api', (req, res, next) => {
    const bearer = req.get('authorization')?.replace(/^Bearer /, '') || '';
    const allowedIntegration = req.method === 'POST' && ['/messages/send', '/messages/send-otp', '/messages/bulk'].includes(req.path);
    if (allowedIntegration && sameSecret(bearer, apiKey)) return next();
    if (allowedIntegration && req.get('authorization')) return res.status(401).json({ success: false, error: 'API key tidak valid.' });
    if (!authenticated(req)) return res.status(401).json({ success: false, error: 'Sesi berakhir. Silakan login kembali.' });
    next();
  });
  app.get('/api/integration/key', (_req, res) => res.json({ success: true, apiKey, source: envKey ? 'environment' : 'generated', deviceId: 'device_primary' }));
  app.post('/api/integration/key/rotate', (req, res) => {
    if (!checkPassword(req.body?.currentPassword, state.passwordHash)) return res.status(403).json({ success: false, error: 'Password admin tidak sesuai.' });
    if (envKey) return res.status(409).json({ success: false, error: 'Key dikelola .env. Ubah GATEWAY_API_KEY di server lalu restart.' });
    const next = 'reev_live_' + crypto.randomBytes(32).toString('hex');
    atomicJson(keyFile, { key: next }); apiKey = next;
    res.json({ success: true, apiKey });
  });
  app.get('/api/auth/verify', (_req, res) => res.json({ success: true, user: { username: state.username, role: 'admin' } }));
  app.post('/api/auth/change-credentials', (req, res) => {
    const { currentPassword, newUsername, newPassword } = req.body || {};
    if (!checkPassword(currentPassword, state.passwordHash)) return res.status(403).json({ success: false, error: 'Password saat ini tidak sesuai.' });
    if (newUsername !== undefined && (typeof newUsername !== 'string' || newUsername.trim().length < 3 || newUsername.trim().length > 80)) return res.status(400).json({ success: false, error: 'Username harus 3–80 karakter.' });
    if (newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 1024)) return res.status(400).json({ success: false, error: 'Password harus 8–1024 karakter.' });
    // Persist credentials AND revoke other sessions atomically before reporting success.
    issue({ username: newUsername?.trim() || state.username, passwordHash: newPassword === undefined ? state.passwordHash : hashPassword(newPassword), sessions: {} }, res);
    res.json({ success: true, username: state.username, message: 'Kredensial tersimpan. Sesi perangkat lain telah dicabut.' });
  });
  app.post('/api/auth/logout', (req, res) => {
    const next = { ...state, sessions: { ...state.sessions } };
    delete next.sessions[digest(getToken(req))];
    commit(next);
    res.clearCookie(COOKIE, cookieOptions);
    res.json({ success: true });
  });
}
