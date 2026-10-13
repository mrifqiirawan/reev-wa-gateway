import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

test('NACK persistence, API response and scoped admin log deletion', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reev-logs-'));
  Object.assign(process.env, { NODE_ENV: 'test', DATA_DIR: dir, ADMIN_PASSWORD: 'Test-password-123', BACKEND_SHARED_SECRET: '', GATEWAY_API_KEY: 'synthetic-key' });
  const seed = (id: string, status: string) => ({id,status,recipient:'628123456789',content:'Synthetic',type:'text',timestamp:new Date().toISOString(),retryCount:0,latencyMs:0,deviceId:'device_primary'});
  fs.writeFileSync(path.join(dir,'gateway_state.json'),JSON.stringify({messageLogs:[seed('old','sent'),seed('active','queued'),seed('keep','read')],inboxMessages:[{id:'inbox-keep'}]}));
  const { default: app } = await import('../server.js');
  const { baileysManager: manager } = await import('../src/server/baileys.js');
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  const base='http://127.0.0.1:'+(server.address() as any).port;
  const call=(route:string,body:unknown,cookie='',method='POST',headers={})=>fetch(base+route,{method,headers:{'content-type':'application/json',cookie,...headers},body:JSON.stringify(body)});
  const saved=()=>JSON.parse(fs.readFileSync(path.join(dir,'gateway_state.json'),'utf8'));
  try {
    const login=await call('/api/auth/login',{username:'admin',password:'Test-password-123'});
    const cookie=login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await call('/api/logs',{ids:['old']},'','DELETE')).status,401);
    assert.equal((await call('/api/logs',{ids:['old']},'','DELETE',{authorization:'Bearer synthetic-key'})).status,401);
    assert.equal((await call('/api/logs',{},cookie,'DELETE')).status,400);
    assert.equal((await call('/api/logs',{ids:['old','active']},cookie,'DELETE')).status,409);
    assert.equal(saved().messageLogs.length,3);
    (manager as any).failureHandler('old','479','Synthetic rejected');
    assert.equal(saved().messageLogs.find((r:any)=>r.id==='old').status,'failed');
    manager.sendTextMessage=async (_phone,_message,onId)=>{onId?.('early');(manager as any).failureHandler('early','463','Synthetic restriction');return {messageId:'early',latencyMs:1};};
    assert.equal((await call('/api/messages/send',{recipient:'628123456789',message:'Synthetic'},cookie)).status,503);
    assert.equal(saved().messageLogs[0].status,'failed');assert.equal(saved().messageLogs[0].errorCode,'463');
    const deleted=await call('/api/logs',{ids:['old','early']},cookie,'DELETE');assert.equal((await deleted.json()).deleted,2);
    assert.deepEqual(saved().messageLogs.map((r:any)=>r.id),['active','keep']);assert.equal(saved().inboxMessages[0].id,'inbox-keep');
    (manager as any).receiptHandler('old','read');assert.equal(saved().messageLogs.length,2);
    assert.equal((await (await call('/api/logs',{ids:['old']},cookie,'DELETE')).json()).deleted,0);
  } finally {await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true});}
});
