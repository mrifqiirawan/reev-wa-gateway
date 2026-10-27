import {validateTemplate} from './reply-template.js';
export type Tier = 'standard' | 'premium' | 'vip';
export type Action = 'reply_text' | 'belajar.register' | 'belajar.profile' | 'belajar.tasks' | 'belajar.grades' | 'belajar.stars' | 'belajar.hearts' | 'belajar.attendance';
export interface BotCategory { id: string; name: string; enabled: boolean }
export interface BotCommand { id: string; command: string; title: string; category: string; action: Action; text: string; cost: number; minTier: Tier; enabled: boolean }
export interface BotConfig { enabled: boolean; title: string; timezone: string; resetHour: number; presentation: 'text' | 'interactive'; plans: Record<Tier,{name:string;price:number;points:number}>; categories: BotCategory[]; commands: BotCommand[] }
export const actions: Record<Action,string> = {reply_text:'Balasan teks', 'belajar.register':'Tautkan NISN', 'belajar.profile':'Profil siswa','belajar.tasks':'Tugas belum selesai','belajar.grades':'Nilai siswa','belajar.stars':'Bintang','belajar.hearts':'Hati & pelanggaran','belajar.attendance':'Kehadiran'};
export const tierOrder: Tier[] = ['standard','premium','vip'];
export const reservedCommands = ['.menu','.point','.paket','.batal','ya','batal'];
export const defaultBotConfig: BotConfig = {
 enabled:false,title:'REEV WA',timezone:'Asia/Makassar',resetHour:2,presentation:'text',
 plans:{standard:{name:'Standar',price:0,points:50},premium:{name:'Premium',price:15000,points:250},vip:{name:'VIP',price:30000,points:700}},
 categories:[{id:'belajar',name:'REEV Belajar · Informatika',enabled:true},{id:'layanan',name:'Layanan',enabled:true}],
 commands:[
  {id:'info_daftar',command:'.infodaftar',title:'Tautkan NISN',category:'belajar',action:'belajar.register',text:'',cost:0,minTier:'standard',enabled:true},
  ...(['profile','tasks','grades','stars','hearts','attendance'] as const).map((a,i)=>({id:'info_'+a,command:['.infoprofil','.infotugas','.infonilai','.infobintang','.infohati','.infoabsen'][i],title:['Profil saya','Tugas saya','Nilai saya','Bintang saya','Hati saya','Kehadiran saya'][i],category:'belajar',action:('belajar.'+a) as Action,text:'',cost:[1,2,2,1,1,1][i],minTier:'standard' as Tier,enabled:true})),
  {id:'help',command:'.bantuan',title:'Panduan singkat',category:'layanan',action:'reply_text',text:'Kirim .menu untuk kategori, .point untuk saldo, dan .paket untuk paket. Untuk REEV Belajar, kirim .infodaftar NISN. Nomor harus diverifikasi guru terlebih dahulu.',cost:0,minTier:'standard',enabled:true}
 ]
};
export function validateConfig(value: unknown): BotConfig {
 const c = value as BotConfig;
 if(!c || typeof c!=='object' || typeof c.enabled!=='boolean' || typeof c.title!=='string' || !c.title.trim() || c.title.length>60) throw Error('Nama bot wajib, maksimal 60 karakter.');
 if(typeof c.timezone!=='string'||!c.timezone||c.timezone.length>80)throw Error('Zona waktu wajib.');
 try {new Intl.DateTimeFormat('id-ID',{timeZone:c.timezone}).format()} catch {throw Error('Zona waktu tidak valid.');}
 if(!Number.isInteger(c.resetHour)||c.resetHour<0||c.resetHour>23||!['text','interactive'].includes(c.presentation))throw Error('Jam reset atau tampilan tidak valid.');
 for(const k of tierOrder){const p=c.plans?.[k];if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>30||!Number.isInteger(p.price)||p.price<0||p.price>100000000||!Number.isInteger(p.points)||p.points<0||p.points>1000000)throw Error('Paket/point tidak valid.');}
 if(c.plans.standard.price!==0)throw Error('Paket Standar harus gratis.');
 if(!Array.isArray(c.categories)||c.categories.length>30||!Array.isArray(c.commands)||c.commands.length>200)throw Error('Maksimal 30 kategori dan 200 fungsi.');
 const ids=new Set<string>(),keys=new Set<string>();
 for(const x of c.categories){if(!/^[a-z][a-z0-9_-]{0,29}$/.test(x.id)||ids.has(x.id)||typeof x.name!=='string'||!x.name.trim()||x.name.length>60||typeof x.enabled!=='boolean')throw Error('Kategori tidak valid/duplikat.');ids.add(x.id);}
 const fids=new Set<string>();
 for(const f of c.commands){if(!/^[a-z][a-z0-9_-]{0,49}$/.test(f.id)||fids.has(f.id)||!/^\.[a-z][a-z0-9_]{0,39}$/.test(f.command)||reservedCommands.includes(f.command)||keys.has(f.command))throw Error('ID/perintah duplikat atau memakai perintah sistem.');
 if(!ids.has(f.category)||typeof f.title!=='string'||!f.title.trim()||f.title.length>80||!Object.hasOwn(actions,f.action)||!tierOrder.includes(f.minTier)||!Number.isInteger(f.cost)||f.cost<0||f.cost>1000000||typeof f.enabled!=='boolean'||typeof f.text!=='string'||f.text.length>3000)throw Error('Pengaturan fungsi tidak valid.');
 if(f.action!=='reply_text')validateTemplate(f.action,f.text);
 if(f.action==='reply_text'&&!f.text.trim())throw Error('Isi balasan teks wajib.');
 if(f.action==='belajar.register'&&(f.cost!==0||f.minTier!=='standard'))throw Error('Penautan NISN harus gratis dan tersedia bagi Standar.');
 fids.add(f.id);keys.add(f.command);}
 return structuredClone(c);
}
