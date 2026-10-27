import test from 'node:test';
import assert from 'node:assert/strict';
import {exampleFor,suggestedTemplate,renderReply,validateTemplate,helpTemplate} from '../src/shared/reply-template.js';
import {BotEngine} from '../src/server/bot-engine.js';
import {defaultBotConfig,validateConfig} from '../src/shared/bot.js';
const actions=['tasks','grades','stars','hearts','attendance'];
const head='SISWA UJI (9C) | NISN 0012345678\n';
const tail='\nMaks. 20 tugas / 10 riwayat terbaru; detail lengkap di website.';
for(const short of actions){
 const action='belajar.'+short;
 test(`${short}: actual engine persists and sends customized reply; errors remain original`,async()=>{
  const config=structuredClone(defaultBotConfig);config.enabled=true;validateConfig(config);
  const f=config.commands.find(c=>c.action===action)!;f.text=suggestedTemplate(action);
  let saved='',sent='',ok=true;
  const store:any={configured:true,config:async()=>({config,revision:1}),rpc:async(name:string,args:any)=>{if(name==='gw_begin')return {run:true,config,context:{},function:f};if(name==='gw_finish')saved=args.p_reply.text;return true;}};
  const source=exampleFor(action);
  const engine=new BotEngine(store,async(_p,r)=>{sent=r.text;return {status:'sent'}},async()=>({ok,text:ok?source:'Nomor belum tertaut'}));
  const input={senderNumber:'628123456789',remoteJid:'628123456789@s.whatsapp.net',sourceMessageId:short,deviceId:'fixture',messageText:f.command};
  await engine.handle(input);assert.equal(saved,sent);assert.notEqual(sent,source);assert.match(sent,/HAI, SISWA CONTOH/);assert.ok(!/\{[^}]+\}/.test(sent));
  ok=false;await engine.handle({...input,sourceMessageId:short+'-error'});assert.equal(sent,'Nomor belum tertaut');
  f.text='';ok=true;await engine.handle({...input,sourceMessageId:short+'-raw'});assert.equal(sent,source);
 });
 test(`${short}: custom variable validation, unknown schema and empty records`,()=>{
  assert.throws(()=>validateTemplate(action,'{unknown}'));
  assert.equal(renderReply(action,suggestedTemplate(action),'Belum ada data semester aktif. Hubungi guru.'),'Belum ada data semester aktif. Hubungi guru.');
  assert.equal(renderReply(action,suggestedTemplate(action),exampleFor(action)+'\nNew data'),exampleFor(action)+'\nNew data');
  const extra=short==='stars'?'Saldo bintang: 0\n':short==='hearts'?'Hati: belum diatur | Pelanggaran aktif: 0\n':'';
  const source=head+extra+'Belum ada catatan.'+tail;
  const result=renderReply(action,suggestedTemplate(action),source);assert.notEqual(result,source);assert.match(result,/SISWA UJI/);
  assert.equal(renderReply(action,'{pesan_asli}',exampleFor(action)),exampleFor(action));
 });
}
test('detail cards preserve titles, status, due dates, deductions and remedies',()=>{
 const task=renderReply('belajar.tasks',suggestedTemplate('belajar.tasks'),exampleFor('belajar.tasks'));
 assert.match(task,/T001 · Algoritma sederhana/);assert.match(task,/2026-11-02/);assert.match(task,/Status: Belum/);assert.match(task,/Nilai: Belum tersedia/);
 const grade=renderReply('belajar.grades',suggestedTemplate('belajar.grades'),exampleFor('belajar.grades'));assert.match(grade,/90,40/);assert.match(grade,/Status: Selesai/);
 const stars=renderReply('belajar.stars',suggestedTemplate('belajar.stars'),exampleFor('belajar.stars'));assert.match(stars,/\+3 — Aktif berdiskusi/);assert.match(stars,/-1 — Koreksi pencatatan/);
 const hearts=renderReply('belajar.hearts',suggestedTemplate('belajar.hearts'),exampleFor('belajar.hearts'));assert.match(hearts,/Perlu ditebus/);assert.match(hearts,/Tebusan: Selesaikan tugas/);
});
test('attendance computes all recorded meetings, missing categories and zero denominator',()=>{
 assert.equal(renderReply('belajar.attendance','{hadir}|{sakit}|{izin}|{alpa}|{total_pertemuan}|{kehadiran}',exampleFor('belajar.attendance')),'8|1|1|0|10|80,0%');
 assert.equal(renderReply('belajar.attendance','{total_pertemuan}|{kehadiran}',head+'Belum ada catatan.'+tail),'0|Belum tersedia');
 for(const body of ['Hadir: 8\nHadir: 1','Terlambat: 2']){const source=head+body+tail;assert.equal(renderReply('belajar.attendance',suggestedTemplate('belajar.attendance'),source),source);}
});
test('help is editable plain text and includes registration and all student commands',()=>{
 for(const c of defaultBotConfig.commands)assert.ok(helpTemplate.includes(c.command)||c.command==='.bantuan');
 assert.match(helpTemplate,/YA/);assert.match(helpTemplate,/BATAL/);assert.ok(!/\{[^}]+\}/.test(helpTemplate));
});
