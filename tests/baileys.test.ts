import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { BaileysManager } from '../src/server/baileys.js';

async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Expected asynchronous state was not reached');
}
test('QR lifecycle uses current socket, persists credentials, prevents duplicate sockets, and resets logout', async () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-baileys-'));
  const sockets: any[] = [];
  let saves = 0;
  const manager = new BaileysManager({
    sessionsDir,
    loadAuth: (async () => ({ state: {}, saveCreds: async () => { saves++; } })) as any,
    makeSocket: (() => {
      const socket = { ev: new EventEmitter(), end: () => {}, logout: async () => {}, user: { id: '628123456:2@s.whatsapp.net', name: 'Test' } };
      sockets.push(socket); return socket;
    }) as any,
  });
  try {
    await Promise.all([manager.initSocket(), manager.initSocket()]);
    assert.equal(sockets.length, 1);
    sockets[0].ev.emit('connection.update', { qr: 'test-qr-payload' });
    await until(() => manager.getDeviceState().status === 'qr_ready');
    assert.match(manager.getDeviceState().qrCode!, /^data:image\/png;base64,/);
    await manager.initSocket(); assert.equal(sockets.length, 1);
    sockets[0].ev.emit('creds.update', {}); assert.equal(saves, 1);
    await manager.reconnect(); assert.equal(sockets.length, 2);
    assert.equal(manager.getDeviceState().qrCode, undefined);
    sockets[0].ev.emit('connection.update', { qr: 'stale-qr' });
    assert.equal(manager.getDeviceState().status, 'connecting');
    sockets[1].ev.emit('connection.update', { connection: 'open' });
    assert.equal(manager.getDeviceState().status, 'connected');
    assert.equal(manager.getDeviceState().phone, '+628123456');
    fs.mkdirSync(path.join(sessionsDir, 'default'));
    fs.writeFileSync(path.join(sessionsDir, 'default/creds.json'), '{}');
    await manager.disconnect();
    assert.equal(manager.getDeviceState().status, 'disconnected');
    assert.equal(fs.existsSync(path.join(sessionsDir, 'default')), false);
    assert.equal(sockets[1].ev.listenerCount('connection.update'), 0);
  } finally { await manager.disconnect(); fs.rmSync(sessionsDir, { recursive: true, force: true }); }
});
test('Baileys initialization failure propagates to API and device status', async () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-baileys-'));
  const manager = new BaileysManager({ sessionsDir, loadAuth: (async () => { throw new Error('disk unavailable'); }) as any, makeSocket: (() => { throw new Error('must not connect'); }) as any });
  await assert.rejects(manager.initSocket(), /disk unavailable/);
  assert.equal(manager.getDeviceState().status, 'disconnected');
  assert.equal(manager.getDeviceState().lastError, 'disk unavailable');
  await manager.disconnect(); fs.rmSync(sessionsDir, { recursive: true, force: true });
});
