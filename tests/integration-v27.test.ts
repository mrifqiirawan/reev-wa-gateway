import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {once, EventEmitter} from 'node:events';
import crypto from 'node:crypto';
import {deliverWebhook} from '../src/server/webhook.js';
test('v2.7 real routes: key lifecycle, transport errors, persistent webhook, SDK',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reev-v27-'));
 Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,ADMIN_PASSWORD:'Test-password-123',GATEWAY_API_KEY:'',BACKEND_SHARED_SECRET:''});
 const {default:app}=await import('../server.js');const {baileysManager}=await import('../src/server/baileys.js');
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+(server.address() as any).port;
 let cookie=''; const post=(p:string,b:unknown,auth='')=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',cookie,...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(b)});
 try {
  assert.equal((await fetch(base+'/api/integration/key')).status,401);
  const login=await post('/api/auth/login',{username:'admin',password:'Test-password-123'});cookie=login.headers.get('set-cookie')!.split(';')[0];
  const info=await (await fetch(base+'/api/integration/key',{headers:{cookie}})).json();assert.match(info.apiKey,/^reev_live_[a-f0-9]{64}$/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'integration_key.json'),'utf8')).key,info.apiKey);
  assert.equal((await post('/api/messages/send',{recipient:'628123456789',message:'test'},'wrong')).status,401);
  const offline=await post('/api/messages/send',{recipient:'628123456789',message:'test'},info.apiKey);assert.equal(offline.status,503);assert.equal((await offline.json()).success,false);
  assert.equal((await post('/api/messages/send-otp',{recipient:'628123456789',otpCode:'1234'},info.apiKey)).status,503);
  baileysManager.sendTextMessage=async()=>({messageId:'mock-sent-id',latencyMs:11});
  const sent=await post('/api/messages/send',{recipient:'08123456789',message:'test'},info.apiKey);const data=await sent.json();assert.equal(data.status,'sent');assert.equal(data.recipient,'628123456789');
  assert.equal((await post('/api/integration/key/rotate',{currentPassword:'bad'})).status,403);
  const rotated=await (await post('/api/integration/key/rotate',{currentPassword:'Test-password-123'})).json();assert.notEqual(rotated.apiKey,info.apiKey);
  assert.equal((await post('/api/messages/send',{recipient:'628123456789',message:'test'},info.apiKey)).status,401);
  const events={onMessageReceived:true,onMessageSent:true,onMessageDelivered:true,onMessageFailed:true,onDeviceStatusChanged:true};
  const cfg=await post('/api/webhook/config',{url:'https://example.com/webhook',secretKey:'test-secret-123456',isEnabled:false,events});assert.equal(cfg.status,200);
  const saved=JSON.parse(fs.readFileSync(path.join(dir,'gateway_state.json'),'utf8'));assert.equal(saved.webhook.url,'https://example.com/webhook');assert.equal(saved.messageLogs[0].status,'sent');
  await post('/api/webhook/config',{url:'https://127.0.0.1/x',secretKey:'test-secret-123456',isEnabled:false,events});const ping=await post('/api/webhook/test',{});assert.equal(ping.status,502);assert.equal((await ping.json()).success,false);
  const sdk=await (await fetch(base+'/api/export/gas',{headers:{cookie}})).text();assert.match(sdk,/getScriptProperties/);assert.doesNotMatch(sdk,/reev_live_sec_prod_key/);
 }finally {await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true});}
});
test('webhook HMAC covers exact body and network status is truthful',async()=>{
 let headers:any;let sent='';
 const deps:any={lookup:async()=>[{address:'93.184.216.34',family:4}],request:(_url:any,opts:any,cb:any)=>{headers=opts.headers;const req:any=new EventEmitter();req.end=(body:string)=>{sent=body;const res:any=new EventEmitter();res.statusCode=503;cb(res);res.emit('data',Buffer.from('{}'));res.emit('end');req.emit('close');};return req;}};
 const result=await deliverWebhook('https://example.com/hook','secret',{event:'test',text:'spasi dua  tetap'},deps);
 assert.equal(result.success,false);assert.equal(result.statusCode,503);assert.equal(headers['X-REEV-Signature'],'sha256='+crypto.createHmac('sha256','secret').update(sent).digest('hex'));
 await assert.rejects(deliverWebhook('http://example.com','secret',{}),/HTTPS/);
 await assert.rejects(deliverWebhook('https://example.com','secret',{}, {...deps,lookup:async()=>[{address:'127.0.0.1',family:4}]}),/privat/);
});
