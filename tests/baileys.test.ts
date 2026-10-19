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
    sockets[0].ev.emit('creds.update', {}); await until(() => saves === 1);
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

for (const code of [401, 500]) {
  test(`invalid auth ${code}: reconnect creates fresh QR and preserves other gateway data`, async () => {
    const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-reset-'));
    const authPath = path.join(sessionsDir, 'default');
    fs.mkdirSync(authPath);
    fs.writeFileSync(path.join(authPath, 'creds.json'), 'revoked');
    fs.writeFileSync(path.join(sessionsDir, 'admin_auth.json'), 'keep-admin');
    const sockets: any[] = [];
    const manager = new BaileysManager({ sessionsDir,
      loadAuth: (async () => {
        const registered = fs.existsSync(path.join(authPath, 'creds.json'));
        return { state: { registered }, saveCreds: async () => {} };
      }) as any,
      makeSocket: ((options: any) => {
        const socket = { ev: new EventEmitter(), end() {}, logout: async () => {}, registered: options.auth.registered };
        sockets.push(socket); return socket;
      }) as any,
    });
    try {
      await manager.initSocket();
      assert.equal(sockets[0].registered, true);
      sockets[0].ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: code } } } });
      assert.equal(manager.getDeviceState().status, 'auth_failure');
      assert.ok(fs.existsSync(path.join(sessionsDir, 'default.invalid')));
      await manager.reconnect();
      assert.equal(sockets[1].registered, false);
      sockets[1].ev.emit('connection.update', { qr: 'fresh-qr' });
      await until(() => manager.getDeviceState().status === 'qr_ready');
      assert.ok(manager.getDeviceState().qrCode);
      assert.equal(fs.readFileSync(path.join(sessionsDir, 'admin_auth.json'), 'utf8'), 'keep-admin');
      sockets[0].ev.emit('connection.update', { connection: 'close' });
      assert.equal(manager.getDeviceState().status, 'qr_ready');
    } finally { await manager.disconnect(); fs.rmSync(sessionsDir, { recursive: true, force: true }); }
  });
}

test('persisted invalid-session marker is consumed after backend restart', async () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-marker-'));
  fs.mkdirSync(path.join(sessionsDir, 'default'));
  fs.writeFileSync(path.join(sessionsDir, 'default/creds.json'), 'revoked');
  fs.writeFileSync(path.join(sessionsDir, 'default.invalid'), 'invalid');
  const manager = new BaileysManager({ sessionsDir,
    loadAuth: (async () => {
      assert.equal(fs.existsSync(path.join(sessionsDir, 'default/creds.json')), false);
      return { state: {}, saveCreds: async () => {} };
    }) as any,
    makeSocket: (() => ({ ev: new EventEmitter(), end() {}, logout: async () => {} })) as any,
  });
  try { await manager.initSocket(); assert.equal(fs.existsSync(path.join(sessionsDir, 'default.invalid')), false); }
  finally { await manager.disconnect(); fs.rmSync(sessionsDir, { recursive: true, force: true }); }
});

test('ordinary reconnect retains valid credentials', async () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-retain-'));
  fs.mkdirSync(path.join(sessionsDir, 'default'));
  fs.writeFileSync(path.join(sessionsDir, 'default/creds.json'), 'valid');
  const manager = new BaileysManager({ sessionsDir,
    loadAuth: (async () => ({ state: {}, saveCreds: async () => {} })) as any,
    makeSocket: (() => ({ ev: new EventEmitter(), end() {}, logout: async () => {} })) as any,
  });
  try { await manager.initSocket(); await manager.reconnect(); assert.equal(fs.readFileSync(path.join(sessionsDir, 'default/creds.json'), 'utf8'), 'valid'); }
  finally { await manager.disconnect(); fs.rmSync(sessionsDir, { recursive: true, force: true }); }
});

test('reconnect waits for in-flight credential save before resetting revoked auth', async () => {
  const sessionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-write-'));
  const authPath = path.join(sessionsDir, 'default');
  fs.mkdirSync(authPath);
  let release!: () => void;
  const writeGate = new Promise<void>(resolve => { release = resolve; });
  const sockets: any[] = [];
  let started = false, loads = 0;
  const manager = new BaileysManager({ sessionsDir,
    loadAuth: (async () => {
      loads++;
      if (loads === 2) assert.equal(fs.existsSync(path.join(authPath, 'creds.json')), false);
      return { state: {}, saveCreds: async () => { started = true; await writeGate; fs.writeFileSync(path.join(authPath, 'creds.json'), 'old'); } };
    }) as any,
    makeSocket: (() => { const s = { ev: new EventEmitter(), end() {}, logout: async () => {} }; sockets.push(s); return s; }) as any,
  });
  try {
    await manager.initSocket(); sockets[0].ev.emit('creds.update', {});
    await until(() => started);
    sockets[0].ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } });
    const reconnect = manager.reconnect(); assert.equal(loads, 1);
    release(); await reconnect; assert.equal(loads, 2);
  } finally { release(); await manager.disconnect(); fs.rmSync(sessionsDir, { recursive: true, force: true }); }
});

test('custom category list uses provider ID before relay and preserves command fallback',async()=>{
 const sessionsDir=fs.mkdtempSync(path.join(os.tmpdir(),'reev-menu-'));let sent:any;let persisted='';
 const manager=new BaileysManager({sessionsDir,loadAuth:(async()=>({state:{},saveCreds:async()=>{}})) as any,makeSocket:(()=>({})) as any});
 (manager as any).status='connected';(manager as any).socket={user:{id:'628123456789@s.whatsapp.net'},relayMessage:async(jid:any,message:any,options:any)=>{assert.equal(persisted,'MENU_TEST_ID');sent={jid,message,options}}};
 try{const result=await manager.sendTextMessage('628123456789','Pilih kategori: .menu belajar',id=>persisted=id,'628123456789@s.whatsapp.net',{messageId:'MENU_TEST_ID',choices:[{id:'.menu belajar',title:'Belajar'}]});assert.equal(result.messageId,'MENU_TEST_ID');assert.equal(sent.options.messageId,'MENU_TEST_ID');const interactive=sent.message.viewOnceMessage.message.interactiveMessage;assert.match(interactive.body.text,/\.menu belajar/);const params=JSON.parse(interactive.nativeFlowMessage.buttons[0].buttonParamsJson);assert.equal(params.sections[0].rows[0].id,'.menu belajar');}
 finally{(manager as any).socket=null;fs.rmSync(sessionsDir,{recursive:true,force:true})}
});
