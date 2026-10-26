import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { BaileysManager } from '../src/server/baileys.js';
import { advanceReceipt, finishSend } from '../src/server/message-status.js';

async function fixture(run: (manager: BaileysManager, socket: any, options: any) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-msg-'));
  const socket: any = { ev: new EventEmitter(), end() {}, logout: async () => {}, user: { id: '62123456789@s.whatsapp.net' },
    signalRepository: { lidMapping: { getPNForLID: async () => undefined } } };
  let options: any;
  const manager = new BaileysManager({ sessionsDir: dir, loadAuth: (async () => ({ state: {}, saveCreds: async () => {} })) as any,
    makeSocket: ((o: any) => { options = o; return socket; }) as any });
  try { await manager.initSocket(); socket.ev.emit('connection.update', { connection: 'open' }); await run(manager, socket, options); }
  finally { await manager.disconnect(); fs.rmSync(dir, { recursive: true, force: true }); }
}
const incoming = (id: string, jid: string, message: any, extra: any = {}) => ({ key: { id, remoteJid: jid, fromMe: false, ...extra }, message, messageTimestamp: 1700000000 });

test('LID, alternative PN, failed mapping, wrapped text, media, append and exclusions', async () => fixture(async (manager, socket) => {
  const rows: any[] = [];
  manager.setIncomingMessageHandler(async row => { rows.push(row); return null; });
  const upsert = socket.ev.listeners('messages.upsert')[0];
  await upsert({ type: 'notify', messages: [
    incoming('a', '999@lid', { conversation: 'hello' }),
    incoming('b', '998@lid', { ephemeralMessage: { message: { extendedTextMessage: { text: 'wrapped' } } } }, { remoteJidAlt: '628123456789:2@s.whatsapp.net' }),
    incoming('c', '628123456789@s.whatsapp.net', { imageMessage: {} }),
    incoming('d', '1@g.us', { conversation: 'group' }),
    incoming('e', 'status@broadcast', { conversation: 'status' }),
    incoming('f', '628123456789@s.whatsapp.net', { conversation: 'self' }, { fromMe: true }),
    incoming('g', '628123456789@s.whatsapp.net', { protocolMessage: {} }),
  ] });
  assert.equal(rows.length, 3);
  // Chats may complete in parallel; validate identity by message id, not cross-chat order.
  rows.sort((a,b)=>a.messageId.localeCompare(b.messageId));
  assert.equal(rows[0].senderNumber, ''); assert.equal(rows[0].remoteJid, '999@lid');
  assert.equal(rows[1].senderNumber, '628123456789'); assert.equal(rows[1].messageText, 'wrapped');
  assert.equal(rows[2].messageText, '[Gambar]'); assert.equal(rows[2].allowAutoReply, false);
  await upsert({ type: 'append', messages: [incoming('offline', '997@lid', { conversation: 'old message' })] });
  assert.equal(rows[3].allowAutoReply, false);
  socket.signalRepository.lidMapping.getPNForLID = async () => { throw Error('unavailable'); };
  await upsert({ type: 'notify', messages: [incoming('mapping-error', '996@lid', { conversation: 'still recorded' })] });
  assert.equal(rows[4].messageText, 'still recorded');
  await manager.reconnect();
  await upsert({ type: 'notify', messages: [incoming('stale', '996@lid', { conversation: 'stale' })] });
  assert.equal(rows.length, 5);
}));

test('persist ID before early receipt; receipt sources are monotonic; retry lookup available', async () => fixture(async (manager, socket, options) => {
  const row = { id: '', status: 'sending' };
  manager.setReceiptHandler((id, status) => { if (id === row.id) advanceReceipt(row, status); });
  manager.setOutgoingMessageLookup(id => id === row.id ? 'payload' : undefined);
  socket.sendMessage = async (jid: string, content: any, opts: any) => {
    assert.equal(row.id, opts.messageId); assert.equal(jid, '999@lid');
    assert.deepEqual(await options.getMessage({ id: row.id, fromMe: true }), { conversation: 'payload' });
    socket.ev.emit('messages.update', [{ key: { id: row.id, fromMe: true }, update: { status: 2 } }]);
    assert.equal(row.status, 'sending');
    socket.ev.emit('message-receipt.update', [{ key: { id: row.id }, receipt: { receiptTimestamp: 100 } }]);
    assert.equal(row.status, 'delivered');
    socket.ev.emit('messages.update', [{ key: { id: row.id }, update: { status: 4 } }]);
    return { key: { id: row.id } };
  };
  await manager.sendTextMessage('', 'payload', id => { row.id = id; }, '999@lid');
  finishSend(row); assert.equal(row.status, 'read');
  socket.ev.emit('message-receipt.update', [{ key: { id: row.id }, receipt: { receiptTimestamp: 200 } }]);
  assert.equal(row.status, 'read');
  assert.equal(advanceReceipt(row, 'read'), false);
  assert.equal(await options.getMessage({ id: 'unknown' }), undefined);
  await manager.disconnect(); assert.equal(socket.ev.listenerCount('message-receipt.update'), 0);
}));

test('different chats in a batch run concurrently; same chat stays FIFO across upserts',async()=>fixture(async(manager,socket)=>{
 let release!:()=>void;const hold=new Promise<void>(r=>release=r);const order:string[]=[];
 manager.setIncomingMessageHandler(async row=>{order.push(row.messageId+'-start');if(row.messageId==='a1')await hold;order.push(row.messageId+'-done');return null;});
 const upsert=socket.ev.listeners('messages.upsert')[0];
 const batch=upsert({type:'notify',messages:[incoming('a1','628111111111@s.whatsapp.net',{conversation:'.menu'}),incoming('b1','628222222222@s.whatsapp.net',{conversation:'.menu'})]});
 const next=upsert({type:'notify',messages:[incoming('a2','628111111111@s.whatsapp.net',{conversation:'.point'})]});
 await new Promise(r=>setImmediate(r));assert.ok(order.includes('b1-done'));assert.ok(!order.includes('a2-start'));
 release();await Promise.all([batch,next]);assert.ok(order.indexOf('a1-done')<order.indexOf('a2-start'));
}));
