import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { installAuth } from '../src/server/auth.js';
import proxy from '../api/index.js';

test('actual API client sends JSON for bodyless actions through direct backend and Vercel proxy', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-json-'));
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_PASSWORD = 'Json-test-password-123';
  delete process.env.BACKEND_SHARED_SECRET;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { removeItem() {} } });
  const { apiService } = await import('../src/services/api.js');
  const app = express(); app.use(express.json()); installAuth(app, dir);
  for (const [method, route] of [['post','/api/devices/init-baileys'], ['post','/api/devices/:id/reconnect'], ['delete','/api/devices/:id'], ['delete','/api/auto-responder/rules/:id']] as const) {
    app[method](route, (req, res) => { assert.deepEqual(req.body, {}); res.json({ success: true }); });
  }
  const backend = createServer(app), bridge = createServer(proxy);
  await new Promise<void>(r => backend.listen(0, '127.0.0.1', r));
  await new Promise<void>(r => bridge.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(backend.address() as any).port}`;
  const proxyBase = `http://127.0.0.1:${(bridge.address() as any).port}`;
  const nativeFetch = globalThis.fetch;
  try {
    const login = await nativeFetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: process.env.ADMIN_PASSWORD }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    // Reproduce original defect: Content-Type alone with an empty DELETE body.
    assert.equal((await nativeFetch(base + '/api/devices/device_primary', { method: 'DELETE', headers: { cookie, 'content-type': 'application/json' } })).status, 403);
    for (const url of [base, proxyBase]) {
      if (url === proxyBase) { process.env.BACKEND_URL = base; process.env.BACKEND_SHARED_SECRET = 'json-test-bridge'; }
      // Proxy itself also uses fetch; forward its absolute requests unchanged.
      globalThis.fetch = ((endpoint: string | URL, options: RequestInit) => String(endpoint).startsWith('http') ? nativeFetch(endpoint, options) : nativeFetch(url + endpoint, { ...options, headers: { ...options.headers, cookie } })) as typeof fetch;
      await apiService.initBaileys(); await apiService.reconnectDevice('device_primary');
      await apiService.deleteDevice('device_primary'); await apiService.deleteAutoResponderRule('test');
      const denied = await nativeFetch(url + '/api/devices/device_primary', { method: 'DELETE', headers: { cookie, 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: '{}' });
      assert.equal(denied.status, 403);
    }
  } finally {
    globalThis.fetch = nativeFetch;
    await Promise.all([backend, bridge].map(server => new Promise<void>(r => server.close(() => r()))));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
