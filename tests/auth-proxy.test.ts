import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { installAuth } from '../src/server/auth.js';
import proxy from '../api/index.js';

async function listen(app: any) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${(server.address() as any).port}` };
}
const close = (server: Server) => new Promise<void>(resolve => server.close(() => resolve()));
const cookie = (res: globalThis.Response) => res.headers.get('set-cookie')!.split(';')[0];

test('persistent auth, password rotation, revocation, storage failure, and Vercel proxy', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-auth-'));
  process.env.ADMIN_PASSWORD = 'Initial-password-123';
  process.env.COOKIE_SECURE = 'true';
  delete process.env.BACKEND_SHARED_SECRET;
  process.env.NODE_ENV = 'test';
  const makeApp = () => {
    const app = express(); app.use(express.json()); installAuth(app, dir);
    app.get('/api/devices', (_req, res) => res.json({ success: true, devices: [{ id: 'device_primary', status: 'qr_ready', qrCode: 'data:image/png;base64,fixture' }] }));
    app.post('/api/messages/send', (_req, res) => res.json({ success: true }));
    app.get('/api/export/project-zip', (_req, res) => res.type('application/zip').send(Buffer.from([80, 75, 3, 4])));
    app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ success: false, error: 'Storage failed' }));
    return app;
  };
  let backend = await listen(makeApp());
  const call = (route: string, options: any = {}) => fetch(backend.url + route, options);
  const post = (route: string, body: unknown, session = '') => call(route, { method: 'POST', headers: { 'content-type': 'application/json', cookie: session }, body: JSON.stringify(body) });
  let session = '';
  let otherSession = '';
  try {
    await t.test('protected API denies anonymous and forged browser tokens', async () => {
      assert.equal((await call('/api/devices')).status, 401);
      assert.equal((await call('/api/devices', { headers: { authorization: 'Bearer reev_client_fake' } })).status, 401);
    });
    await t.test('login issues persistent HttpOnly Secure cookie', async () => {
      const res = await post('/api/auth/login', { username: 'admin', password: process.env.ADMIN_PASSWORD });
      assert.equal(res.status, 200); session = cookie(res);
      assert.match(res.headers.get('set-cookie')!, /HttpOnly/);
      assert.match(res.headers.get('set-cookie')!, /Secure/);
      assert.match(res.headers.get('set-cookie')!, /Max-Age=604800/);
      otherSession = cookie(await post('/api/auth/login', { username: 'admin', password: process.env.ADMIN_PASSWORD }));
      const stored = fs.readFileSync(path.join(dir, 'admin_auth.json'), 'utf8');
      assert.ok(!stored.includes(process.env.ADMIN_PASSWORD!));
      assert.ok(!stored.includes(session.split('=')[1]));
    });
    await t.test('session survives backend reconstruction/restart', async () => {
      await close(backend.server); backend = await listen(makeApp());
      assert.equal((await call('/api/auth/verify', { headers: { cookie: session } })).status, 200);
    });
    await t.test('changing password rejects old password and revokes other sessions', async () => {
      const res = await post('/api/auth/change-credentials', { currentPassword: process.env.ADMIN_PASSWORD, newPassword: 'New-password-456', newUsername: 'owner' }, session);
      assert.equal(res.status, 200); const oldSession = session; session = cookie(res);
      assert.equal((await call('/api/auth/verify', { headers: { cookie: oldSession } })).status, 401);
      assert.equal((await call('/api/auth/verify', { headers: { cookie: otherSession } })).status, 401);
      assert.equal((await post('/api/auth/login', { username: 'owner', password: process.env.ADMIN_PASSWORD })).status, 401);
      await close(backend.server); backend = await listen(makeApp());
      assert.equal((await post('/api/auth/login', { username: 'owner', password: 'New-password-456' })).status, 200);
      assert.equal((await call('/api/auth/verify', { headers: { cookie: session } })).status, 200);
    });
    await t.test('invalid password change does not mutate credentials', async () => {
      assert.equal((await post('/api/auth/change-credentials', { currentPassword: 'wrong', newPassword: 'Something-new' }, session)).status, 403);
      assert.equal((await post('/api/auth/change-credentials', { currentPassword: 'New-password-456', newPassword: 'short' }, session)).status, 400);
    });
    await t.test('disk failure returns error and does not accept unsaved password', async () => {
      const file = path.join(dir, 'admin_auth.json');
      fs.renameSync(file, file + '.backup'); fs.mkdirSync(file);
      const failed = await post('/api/auth/change-credentials', { currentPassword: 'New-password-456', newPassword: 'Unsaved-password-789' }, session);
      assert.equal(failed.status, 500);
      fs.rmdirSync(file); fs.renameSync(file + '.backup', file);
      assert.equal((await post('/api/auth/login', { username: 'owner', password: 'Unsaved-password-789' })).status, 401);
      assert.equal((await post('/api/auth/login', { username: 'owner', password: 'New-password-456' })).status, 200);
    });
    await t.test('CSRF requests rejected; API key scoped to sending only', async () => {
      const res = await call('/api/auth/logout', { method: 'POST', headers: { cookie: session, 'content-type': 'text/plain' }, body: '{}' });
      assert.equal(res.status, 403);
      process.env.GATEWAY_API_KEY = 'integration-secret';
      const headers = { authorization: 'Bearer integration-secret', 'content-type': 'application/json' };
      assert.equal((await call('/api/messages/send', { method: 'POST', headers, body: '{}' })).status, 200);
      assert.equal((await call('/api/devices', { headers })).status, 401);
    });
    const bridge = await listen(proxy);
    try {
      await t.test('proxy fails explicitly without configuration', async () => {
        delete process.env.BACKEND_URL;
        assert.equal((await fetch(bridge.url + '/api/auth/verify')).status, 503);
      });
      process.env.BACKEND_URL = backend.url; process.env.BACKEND_SHARED_SECRET = 'test-bridge-secret';
      await t.test('proxy forwards login cookie, rewritten paths, latest QR and binary exports', async () => {
        assert.equal((await call('/api/devices', { headers: { cookie: session } })).status, 403);
        const login = await fetch(bridge.url + '/api/index?path=auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'owner', password: 'New-password-456' }) });
        assert.equal(login.status, 200); session = cookie(login);
        const qr = await fetch(bridge.url + '/api/index?path=devices', { headers: { cookie: session } });
        assert.equal(qr.status, 200); assert.equal((await qr.json()).devices[0].status, 'qr_ready');
        assert.equal(qr.headers.get('cache-control'), 'no-store');
        const zip = await fetch(bridge.url + '/api/export/project-zip', { headers: { cookie: session } });
        assert.deepEqual(Buffer.from(await zip.arrayBuffer()), Buffer.from([80, 75, 3, 4]));
        assert.equal((await fetch(bridge.url + '/api/index?path=..%2Fprivate')).status, 400);
      });
      await t.test('logout persists revocation', async () => {
        const res = await fetch(bridge.url + '/api/auth/logout', { method: 'POST', headers: { cookie: session, 'content-type': 'application/json' }, body: '{}' });
        assert.equal(res.status, 200);
        await close(backend.server); backend = await listen(makeApp()); process.env.BACKEND_URL = backend.url;
        assert.equal((await fetch(bridge.url + '/api/auth/verify', { headers: { cookie: session } })).status, 401);
      });
      await t.test('offline backend returns explicit 502', async () => {
        await close(backend.server);
        assert.equal((await fetch(bridge.url + '/api/devices')).status, 502);
      });
    } finally { await close(bridge.server); }
  } finally {
    await close(backend.server); fs.rmSync(dir, { recursive: true, force: true }); delete process.env.BACKEND_SHARED_SECRET;
  }
});

test('legacy plaintext credentials migrate without default password reset', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-migrate-'));
  const file = path.join(dir, 'admin_auth.json');
  fs.writeFileSync(file, JSON.stringify({ username: 'legacy', password: 'old-custom-password' }));
  installAuth(express(), dir);
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.username, 'legacy'); assert.ok(saved.passwordHash); assert.equal(saved.password, undefined);
  fs.writeFileSync(file, 'broken json');
  assert.throws(() => installAuth(express(), dir));
  fs.rmSync(dir, { recursive: true, force: true });
});
