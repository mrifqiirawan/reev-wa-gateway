import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {createServer} from 'node:http';import {EventEmitter} from 'node:events';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
test('environment authentication, masking, validation, persistence and live update',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reev-env-'));process.env.DATA_DIR=dir;process.env.ADMIN_PASSWORD='test-password-123';process.env.COOKIE_SECURE='false';delete process.env.BACKEND_SHARED_SECRET;
 const {installAuth}=await import('../src/server/auth.js');const {installEnvironmentApi}=await import('../src/server/environment.js');
 const app=express();app.use(express.json());installAuth(app,dir);installEnvironmentApi(app);const server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const send=(method:string,route:string,body?:any,cookie='')=>fetch(base+route,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});
 try{
 assert.equal((await send('GET','/api/environment')).status,401);
 const login=await send('POST','/api/auth/login',{username:'admin',password:'test-password-123'});const cookie=login.headers.get('set-cookie')!.split(';')[0];
 assert.equal((await send('PUT','/api/environment',{values:{NODE_OPTIONS:'--bad'}},cookie)).status,400);
 assert.equal((await send('PUT','/api/environment',{values:{WEBHOOK_TIMEOUT_MS:'999999'}},cookie)).status,400);
 const secret='z'.repeat(40);assert.equal((await send('PUT','/api/environment',{values:{BELAJAR_FUNCTION_SECRET:secret,WEBHOOK_TIMEOUT_MS:'45000'}},cookie)).status,200);
 assert.equal(process.env.WEBHOOK_TIMEOUT_MS,'45000');assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'environment.json'),'utf8')).BELAJAR_FUNCTION_SECRET,secret);
 assert.equal((fs.statSync(path.join(dir,'environment.json')).mode&0o777),0o600);
 const text=await(await send('GET','/api/environment',undefined,cookie)).text();assert.ok(!text.includes(secret));
 await send('PUT','/api/environment',{values:{TZ:'Asia/Jakarta'}},cookie);assert.equal(process.env.BELAJAR_FUNCTION_SECRET,secret);
 }finally{await new Promise<void>(r=>server.close(()=>r()));fs.rmSync(dir,{recursive:true,force:true})}
});
test('webhook configurable deadline includes DNS; timeout is not retried',async()=>{
 const {deliverWebhook}=await import('../src/server/webhook.js');process.env.WEBHOOK_TIMEOUT_MS='30';
 let calls=0;const deps:any={lookup:async()=>[{address:'8.8.8.8',family:4}],request:()=>{calls++;const req:any=new EventEmitter();req.end=()=>{};req.destroy=(e:Error)=>{req.emit('error',e);req.emit('close')};return req;}};
 await assert.rejects(deliverWebhook('https://example.com','key',{},deps),/Hasil proses tujuan belum diketahui/);assert.equal(calls,1);
 calls=0;await assert.rejects(deliverWebhook('https://example.com','key',{}, {...deps,lookup:()=>new Promise(()=>{})}),/timeout/);assert.equal(calls,0);delete process.env.WEBHOOK_TIMEOUT_MS;
});
