import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';import {defaultBotConfig} from '../src/shared/bot.js';
test('admin UI edits menu/point, previews without send, and saves member with request ID',async()=>{
 const window=new Window({url:'http://localhost'});
 for(const name of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','MutationObserver','localStorage'])Object.defineProperty(globalThis,name,{value:name==='window'?window:(window as any)[name],configurable:true,writable:true});
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const config=structuredClone(defaultBotConfig);for(const f of config.commands)if(f.action!=='reply_text')f.text='📚 *REEV BELAJAR*\n{pesan_asli}';let saved:any;let member:any;const calls:string[]=[];
 const nativeFetch=globalThis.fetch;
 globalThis.fetch=(async(url:any,opts:any={})=>{const path=String(url);calls.push(path);let data:any={success:true};const b=opts.body?JSON.parse(opts.body):{};
  if(path==='/api/bot')data={success:true,configured:true,integrationConfigured:true,config,revision:1};
  else if(path==='/api/bot/config'){saved=b;data.revision=2}
  else if(path==='/api/bot/preview')data.reply={text:'Preview fixture .infoprofil'};
  else if(path.startsWith('/api/bot/members')&&opts.method==='POST')member=b;
  else data={success:true,rows:[],total:0};
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 }) as any;
 const React=await import('react');const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react');const {BotManagementView}=await import('../src/components/views/BotManagementView.js');
 try{
  render(React.createElement(BotManagementView));await waitFor(()=>assert.ok(screen.getByText('Menu WhatsApp & keanggotaan')));await waitFor(()=>assert.ok(!screen.queryByText('Memuat data…')));
  // Start with saved legacy wrappers to prove selecting examples changes persisted config.
  const {within}=await import('@testing-library/react');
  for(const cmd of ['.infotugas','.infonilai','.infobintang','.infohati','.infoabsen']){
   const field=screen.getByLabelText('Template balasan '+cmd);
   const section=field.closest('details')!;section.open=true;
   fireEvent.click(within(section).getByRole('button',{name:'Gunakan contoh menarik'}));
   assert.ok(!(field as HTMLTextAreaElement).value.includes('{pesan_asli}'));
   assert.ok(section.textContent?.includes('SISWA CONTOH'));
  }
  const help=screen.getByText('.bantuan',{selector:'span'}).closest('details')!;help.open=true;
  fireEvent.click(within(help).getByRole('button',{name:'Gunakan contoh bantuan menarik'}));
  fireEvent.click(screen.getByRole('button',{name:'Simpan'}));
  await waitFor(()=>assert.ok(saved.config.commands.find((c:any)=>c.command==='.infoabsen').text.includes('{kehadiran}')));
  assert.ok(saved.config.commands.find((c:any)=>c.command==='.bantuan').text.includes('SELAMAT DATANG'));
  fireEvent.change(screen.getByLabelText('Nama bot'),{target:{value:'REEV Sekolah'}});fireEvent.click(screen.getByRole('button',{name:'Simpan'}));await waitFor(()=>assert.equal(saved.config.title,'REEV Sekolah'));assert.equal(saved.revision,2);
  fireEvent.click(screen.getByRole('button',{name:'Tampilkan'}));await waitFor(()=>assert.ok(screen.getByText('Preview fixture .infoprofil')));assert.ok(!calls.some(x=>x.includes('messages/send')));
  fireEvent.click(screen.getByRole('button',{name:'Paket & point'}));const inputs=screen.getAllByLabelText('Point setiap hari');fireEvent.change(inputs[0],{target:{value:'60'}});fireEvent.click(screen.getByRole('button',{name:'Simpan'}));await waitFor(()=>assert.equal(saved.config.plans.standard.points,60));
  fireEvent.click(screen.getByRole('button',{name:'Anggota'}));await waitFor(()=>assert.ok(screen.getByRole('button',{name:'Tambah / atur nomor'})));fireEvent.click(screen.getByRole('button',{name:'Tambah / atur nomor'}));fireEvent.change(screen.getByLabelText('Nomor WhatsApp'),{target:{value:'6281234567890'}});fireEvent.change(screen.getByLabelText('Alasan perubahan'),{target:{value:'Fixture verification'}});fireEvent.click(screen.getByRole('button',{name:'Simpan anggota'}));await waitFor(()=>assert.equal(member.phone,'6281234567890'));assert.match(member.requestId,/^[0-9a-f-]{36}$/);assert.equal(member.adjust,0);
 }finally{cleanup();globalThis.fetch=nativeFetch;await window.happyDOM.close();}
});
