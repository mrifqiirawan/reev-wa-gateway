import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {EventEmitter} from 'node:events';
import {BotEngine} from '../src/server/bot-engine.js';import {defaultBotConfig} from '../src/shared/bot.js';import {exampleReply} from '../src/shared/reply-template.js';import {BaileysManager} from '../src/server/baileys.js';
const until=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,10))}assert.fail('Timed out')};
test('group engine: registration stays private, student lookup stays self, target NISN uses privileged RPC, mutations stay admin-only',async()=>{
 process.env.BOT_GROUP_ENABLED='true';
 const config=structuredClone(defaultBotConfig);config.enabled=true;const sent:any[]=[],self:any[]=[],admin:any[]=[];let pendingChecks=0;
 const store:any={configured:true,config:async()=>({config,revision:1}),rpc:async(name:string,a:any)=>{if(name==='gw_begin')return {run:true,config,context:{plan:{name:'Standar'},remaining:50},function:config.commands.find(f=>f.command===a.p_command)};if(name==='gw_context'){pendingChecks++;return {pending:true}}return true}};
 const engine=new BotEngine(store,async(p,r,id,jid)=>{sent.push({p,r,jid});return {status:'sent'}},async(...args)=>{self.push(args);return {ok:true,text:exampleReply}},async(...args)=>{admin.push(args);return args[1]==='+628111111111'?{ok:true,text:args[2]==='star'?'⭐ Tersimpan':exampleReply}:{ok:false,text:'Hanya admin terdaftar'}});
 let n=0;const input=(text:string,phone='628222222222',jid='120363000000@g.us')=>({senderNumber:phone,messageText:text,remoteJid:jid,sourceMessageId:String(++n),deviceId:'test'});
 try{
 await engine.handle(input('.infodaftar 0012345678'));assert.match(sent.at(-1).r.text,/chat pribadi/);assert.equal(self.length,0);assert.equal(admin.length,0);
 await engine.handle(input('YA'));await engine.handle(input('BATAL'));assert.equal(pendingChecks,0);
 await engine.handle(input('.batal'));assert.equal(self.length,0);
 await engine.handle(input('.infoprofil'));assert.equal(self.at(-1)[1],'+628222222222');assert.equal(self.at(-1)[3],'');assert.equal(sent.at(-1).jid,'120363000000@g.us');
 await engine.handle(input('.infoprofil 0012345678'));assert.equal(admin.at(-1)[3],'0012345678');assert.equal(sent.at(-1).r.text,'Hanya admin terdaftar');
 await engine.handle(input('.infoprofil 0012345678','628111111111'));assert.match(sent.at(-1).r.text,/HAI, SISWA CONTOH/);
 await engine.handle(input('.bintang 0012345678#2#Aktif belajar','628111111111'));assert.equal(admin.at(-1)[2],'star');assert.equal(admin.at(-1)[3],'0012345678#2#Aktif belajar');
 await engine.handle(input('.pelanggaran 0012345678#Terlambat#Selesaikan tugas'));assert.equal(admin.at(-1)[2],'violation');assert.equal(sent.at(-1).r.text,'Hanya admin terdaftar');
 await engine.handle(input('.infoprofil 0012345678','628111111111','628111111111@s.whatsapp.net'));assert.equal(admin.at(-1)[4],'628111111111@s.whatsapp.net');
 const count=sent.length;process.env.BOT_GROUP_ENABLED='false';await engine.handle(input('.infoprofil'));assert.equal(sent.length,count);
 }finally{delete process.env.BOT_GROUP_ENABLED}
});
test('Baileys group sender uses participant PN or LID mapping, never group/quoted identity; sends back to original group',async()=>{
 process.env.BOT_GROUP_ENABLED='true';const sessionsDir=fs.mkdtempSync(path.join(os.tmpdir(),'reev-group-'));let socket:any;const seen:any[]=[],sends:any[]=[];
 const manager=new BaileysManager({sessionsDir,loadAuth:(async()=>({state:{},saveCreds:async()=>{}})) as any,makeSocket:(()=>socket={ev:new EventEmitter(),user:{id:'628999999999@s.whatsapp.net'},end:()=>{},logout:async()=>{},signalRepository:{lidMapping:{getPNForLID:async(lid:string)=>lid==='888@lid'?'628333333333@s.whatsapp.net':undefined}},sendMessage:async(jid:string,body:any)=>{sends.push({jid,body});return {key:{id:'sent-1'}}}}) as any});
 try{
 manager.setIncomingMessageHandler(async m=>{seen.push(m);return null});await manager.initSocket();socket.ev.emit('connection.update',{connection:'open'});
 const emit=(id:string,participant:string,participantAlt?:string,text='.infoprofil',type='notify',fromMe=false)=>socket.ev.emit('messages.upsert',{type,messages:[{key:{id,remoteJid:'120363000000@g.us',participant,participantAlt,fromMe,remoteJidAlt:'628111111111@s.whatsapp.net'},message:{extendedTextMessage:{text,contextInfo:{participant:'628111111111@s.whatsapp.net'}}}}]});
 emit('pn','628222222222@s.whatsapp.net');emit('alt','777@lid','628444444444@s.whatsapp.net');emit('map','888@lid');
 await until(()=>seen.length===3);assert.deepEqual(seen.map(x=>x.senderNumber),['628222222222','628444444444','628333333333']);assert.ok(seen.every(x=>x.remoteJid==='120363000000@g.us'));
 emit('unknown','999@lid');emit('chat','628222222222@s.whatsapp.net',undefined,'halo');emit('history','628222222222@s.whatsapp.net',undefined,'.bintang 0012345678#1#x','append');emit('self','628222222222@s.whatsapp.net',undefined,'.infoprofil','notify',true);
 await new Promise(r=>setTimeout(r,60));assert.equal(seen.length,3);
 await manager.sendTextMessage('628222222222','Group reply',undefined,'120363000000@g.us');assert.equal(sends.at(-1).jid,'120363000000@g.us');
 await assert.rejects(()=>manager.sendTextMessage('628222222222','No',undefined,'status@broadcast'));
 process.env.BOT_GROUP_ENABLED='false';emit('off','628222222222@s.whatsapp.net');await new Promise(r=>setTimeout(r,30));assert.equal(seen.length,3);
 }finally{delete process.env.BOT_GROUP_ENABLED;await manager.disconnect();fs.rmSync(sessionsDir,{recursive:true,force:true})}
});
