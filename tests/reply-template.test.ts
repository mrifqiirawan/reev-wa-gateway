import test from 'node:test';import assert from 'node:assert/strict';import {profileTemplate,exampleReply,renderReply,validateTemplate} from '../src/shared/reply-template.js';
test('profile template formats real fields, missing scores, leading zero NISN and zero tasks',()=>{
const r=renderReply('belajar.profile',profileTemplate,exampleReply);assert.match(r,/HAI, SISWA CONTOH/);assert.match(r,/90,40/);assert.match(r,/Nilai ujian: Belum tersedia/);assert.match(r,/1 tugas/);assert.match(r,/selesaikan tugasmu/);
assert.equal(renderReply('belajar.profile','{nisn}',exampleReply),'0012345678');assert.match(renderReply('belajar.profile',profileTemplate,exampleReply.replace('Belum selesai: 1','Belum selesai: 0')),/Semua tugas sudah selesai/);
});
test('errors, unknown schema and long output retain original; instructions cannot be omitted',()=>{
assert.equal(renderReply('belajar.profile',profileTemplate,'Akses ditolak',false),'Akses ditolak');assert.equal(renderReply('belajar.profile',profileTemplate,'new schema'),'new schema');assert.throws(()=>validateTemplate('belajar.profile','{unknown}'));assert.throws(()=>validateTemplate('belajar.register','Sukses!'));assert.equal(renderReply('belajar.register','🌸\n{pesan_asli}','Balas YA dalam 5 menit'),'🌸\nBalas YA dalam 5 menit');assert.equal(renderReply('belajar.tasks','{pesan_asli}{pesan_asli}','x'.repeat(8000)),'x'.repeat(8000));
});

test('bot engine persists and sends rendered profile rather than raw function text',async()=>{
 const {BotEngine}=await import('../src/server/bot-engine.js');const {defaultBotConfig}=await import('../src/shared/bot.js');
 const config=structuredClone(defaultBotConfig);config.enabled=true;const f=config.commands.find(c=>c.action==='belajar.profile')!;f.text=profileTemplate;
 const original=`SISWA UJI (9C) | NISN 0012345678
Semester aktif • rata-rata sementara
Formatif: 90.40 | Sumatif: —
Dinilai: 5 | Belum selesai: 1
Bintang: 2 | Hati: 10 | Pelanggaran aktif: 0
Kehadiran: —%`;
 let saved='',sent='';let ok=true;
 const store:any={configured:true,config:async()=>({config,revision:1}),rpc:async(name:string,args:any)=>{if(name==='gw_begin')return {run:true,config,context:{},function:f};if(name==='gw_finish')saved=args.p_reply.text;return true;}};
 const engine=new BotEngine(store,async(_p,r)=>{sent=r.text;return {status:'sent'}},async()=>({ok,text:ok?original:'Nomor belum tertaut'}));
 const input={senderNumber:'628123456789',remoteJid:'628123456789@s.whatsapp.net',sourceMessageId:'test-1',deviceId:'fixture',messageText:'.infoprofil'};
 await engine.handle(input);assert.match(sent,/🌸 \*HAI, SISWA UJI!\*/);assert.match(sent,/90,40/);assert.match(sent,/Nilai ujian: Belum tersedia/);assert.equal(saved,sent);assert.ok(!sent.includes('{nama}'));assert.notEqual(sent,original);
 ok=false;await engine.handle({...input,sourceMessageId:'test-2'});assert.equal(sent,'Nomor belum tertaut');
 f.text='';ok=true;await engine.handle({...input,sourceMessageId:'test-3'});assert.equal(sent,original);
});
