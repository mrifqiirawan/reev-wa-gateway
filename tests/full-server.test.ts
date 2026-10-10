import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

test('real production backend preserves session and changed password across process restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-process-'));
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = (probe.address() as any).port; await new Promise<void>(resolve => probe.close(() => resolve()));
  let child: ChildProcess | undefined;
  const url = `http://127.0.0.1:${port}`;
  const start = async () => {
    let output = '';
    child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env: { ...process.env, NODE_ENV: 'production', PORT: String(port), DATA_DIR: dir, ADMIN_PASSWORD: 'Production-test-123', COOKIE_SECURE: 'false', VERCEL: '', BACKEND_SHARED_SECRET: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout?.on('data', data => output += data);
    child.stderr?.on('data', data => output += data);
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(output);
      try { if ((await fetch(url + '/api/health')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Backend failed to start: ' + output);
  };
  const stop = async () => { if (child && child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } };
  const post = (route: string, body: unknown, cookie = '') => fetch(url + route, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body) });
  try {
    await start();
    const login = await post('/api/auth/login', { username: 'admin', password: 'Production-test-123' });
    assert.equal(login.status, 200);
    let cookie = login.headers.get('set-cookie')!.split(';')[0];
    const changed = await post('/api/auth/change-credentials', { currentPassword: 'Production-test-123', newPassword: 'Changed-test-456' }, cookie);
    assert.equal(changed.status, 200); cookie = changed.headers.get('set-cookie')!.split(';')[0];
    await stop(); await start();
    assert.equal((await fetch(url + '/api/auth/verify', { headers: { cookie } })).status, 200);
    assert.equal((await post('/api/auth/login', { username: 'admin', password: 'Production-test-123' })).status, 401);
    assert.equal((await post('/api/auth/login', { username: 'admin', password: 'Changed-test-456' })).status, 200);
    const devices = await fetch(url + '/api/devices', { headers: { cookie } });
    assert.equal((await devices.json()).devices[0].status, 'disconnected');
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
