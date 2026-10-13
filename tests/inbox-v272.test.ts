import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('server persists deduplicated LID inbox and routes replies to LID; early receipts survive API completion', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-inbox-'));
  Object.assign(process.env, { NODE_ENV: 'test', DATA_DIR: dir, ADMIN_PASSWORD: 'Test-password-123', BACKEND_SHARED_SECRET: '', GATEWAY_API_KEY: '' });
  const { default: app } = await import('../server.js');
  const { baileysManager: manager } = await import('../src/server/baileys.js');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as any).port;
  const sent: any[] = [];
  manager.sendTextMessage = async (phone, message, onId, jid) => {
    const messageId = 'synthetic-' + (sent.length + 1);
    onId?.(messageId);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'gateway_state.json'), 'utf8')).messageLogs[0].id, messageId);
    (manager as any).receiptHandler(messageId, 'read');
    sent.push({ phone, message, jid }); return { messageId, latencyMs: 9 };
  };
  try {
    const receive = (manager as any).incomingMessageHandler;
    const row = { messageId: 'incoming-1', remoteJid: '999@lid', senderNumber: '', senderName: 'Synthetic', messageText: 'menu', timestamp: new Date().toISOString(), allowAutoReply: true };
    await Promise.all([receive(row), receive(row)]);
    assert.equal(sent.length, 1); assert.equal(sent[0].jid, '999@lid');
    await receive({ ...row, messageId: 'offline-1', allowAutoReply: false });
    assert.equal(sent.length, 1);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'gateway_state.json'), 'utf8'));
    assert.equal(saved.inboxMessages.length, 2); assert.equal(saved.inboxMessages[1].status, 'replied');
    assert.equal(saved.messageLogs[0].status, 'read');
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Test-password-123' }) });
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    const res = await fetch(base + '/api/messages/send', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ recipient: '628123456789', message: 'test' }) });
    assert.equal(res.status, 200); assert.equal((await res.json()).status, 'read');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(dir, { recursive: true, force: true }); }
});
