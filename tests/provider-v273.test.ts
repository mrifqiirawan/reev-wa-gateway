import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { BaileysManager } from '../src/server/baileys.js';
import { advanceReceipt, failSend, finishSend } from '../src/server/message-status.js';
test('number validation and asynchronous provider failure lifecycle', async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reev-provider-'));
 const socket:any={ev:new EventEmitter(),end(){},logout:async()=>{},user:{id:'628123456789@s.whatsapp.net'}};
 const manager=new BaileysManager({sessionsDir:dir,loadAuth:(async()=>({state:{},saveCreds:async()=>{}})) as any,makeSocket:(()=>socket) as any});
 try{
  await manager.initSocket();socket.ev.emit('connection.update',{connection:'open'});
  let sends=0; const row={id:'',status:'sending',errorCode:undefined as string|undefined,errorMessage:undefined as string|undefined};
  manager.setFailureHandler((id,code,reason)=>{if(id===row.id)failSend(row,code,reason);});
  socket.onWhatsApp=async()=>[];
  socket.sendMessage=async(jid:string,_:unknown,opts:any)=>{sends++;assert.equal(jid,'628123456789@s.whatsapp.net');socket.ev.emit('messages.update',[{key:{id:opts.messageId,fromMe:true},update:{status:0,messageStubParameters:['463']}}]);return {key:{id:opts.messageId}};};
  await assert.rejects(manager.sendTextMessage('08123456789','test'),/tidak terdaftar/);
  socket.onWhatsApp=async()=>undefined;
  await assert.rejects(manager.sendTextMessage('08123456789','test'),/belum mendapat jawaban/);assert.equal(sends,0);
  socket.onWhatsApp=async(phone:string)=>{assert.equal(phone,'628123456789');return [{exists:true,jid:phone+'@s.whatsapp.net'}];};
  await manager.sendTextMessage('08123456789','test',id=>row.id=id);finishSend(row);
  assert.equal(row.status,'failed');assert.equal(row.errorCode,'463');assert.match(row.errorMessage!,/token privasi/);
  row.status='sent';socket.ev.emit('messages.update',[{key:{id:row.id},update:{status:0,messageStubParameters:['479']}}]);assert.equal(row.status,'failed');assert.equal(row.errorCode,'479');
  advanceReceipt(row,'read');failSend(row,'463','late');assert.equal(row.status,'read');assert.equal(row.errorCode,undefined);
  const old=socket.ev.listeners('messages.update')[0];await manager.reconnect();row.status='sent';old([{key:{id:row.id},update:{status:0}}]);assert.equal(row.status,'sent');
 }finally{await manager.disconnect();fs.rmSync(dir,{recursive:true,force:true});}
});
