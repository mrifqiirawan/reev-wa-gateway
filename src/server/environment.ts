import {belajarMode,belajarDatabase} from './belajar-client.js';
import {performanceSnapshot} from './performance.js';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import type {Express} from 'express';
import {atomicJson} from './auth.js';
import {BotStore} from './bot-store.js';
import {deliverWebhook} from './webhook.js';
export const fields = [
 {key:'BOT_GROUP_ENABLED',fallback:'false',help:'true: balas perintah di grup yang diikuti bot. Data balasan dapat dibaca semua anggota grup. Pendaftaran tetap melalui chat pribadi.'},
 {key:'BELAJAR_TRANSPORT',fallback:'webhook',help:'Pilih webhook (jalur lama) atau supabase_rpc (langsung ke fungsi database, tanpa Vercel).'},
 {key:'BELAJAR_SUPABASE_URL',help:'Wajib untuk supabase_rpc. Project Belajar Anda: https://ccrbbfpmlmifetfavndy.supabase.co'},
 {key:'BELAJAR_SUPABASE_SERVICE_ROLE_KEY',secret:true,help:'Wajib untuk supabase_rpc. Service role key project BELAJAR, hanya tersimpan di server. Bukan anon key.'},
 {key:'BOT_SUPABASE_URL',help:'Wajib untuk menu bot. Project URL Supabase Gateway, https://PROJECT.supabase.co.'},
 {key:'BOT_SUPABASE_SERVICE_ROLE_KEY',secret:true,help:'Wajib untuk bot. Service role key dari project yang sama. Jangan gunakan anon key.'},
 {key:'BELAJAR_FUNCTION_URL',help:'Wajib hanya pada mode webhook. https://DOMAIN-BELAJAR/api/gateway-functions'},
 {key:'BELAJAR_FUNCTION_SECRET',secret:true,help:'Wajib hanya pada mode webhook. Minimal 32 karakter, sama persis dengan REEV_GATEWAY_FUNCTION_SECRET di Vercel Belajar.'},
 {key:'WEBHOOK_TIMEOUT_MS',fallback:'30000',help:'Batas total webhook 1000–60000 milidetik, termasuk DNS. Default 30000. Tidak mempercepat server tujuan.'},
 {key:'BOT_DB_TIMEOUT_MS',fallback:'12000',help:'Batas satu permintaan database 1000–20000 milidetik. Default 12000.'},
 {key:'TZ',fallback:'Asia/Makassar',help:'Zona waktu statistik, misalnya Asia/Jakarta. Zona waktu point diatur pada Menu, Paket & Point.'},
] as const;
const file=path.resolve(process.env.DATA_DIR || 'sessions','environment.json');
export function validateEnvironment(values:Record<string,string>) {
 for(const [key,value] of Object.entries(values)) {
  if(!fields.some(f=>f.key===key)||typeof value!=='string'||value.length>4096||/[\r\n\0]/.test(value))throw Error('Variabel tidak diizinkan atau format tidak valid.');
  if(!value)continue;
  if(key==='BOT_GROUP_ENABLED'&&!['true','false'].includes(value))throw Error('BOT_GROUP_ENABLED harus true atau false.');
  if(key==='BELAJAR_TRANSPORT'&&!['webhook','supabase_rpc'].includes(value))throw Error('Pilih webhook atau supabase_rpc.');
  if(key==='BOT_SUPABASE_URL'||key==='BELAJAR_SUPABASE_URL'||key==='BELAJAR_FUNCTION_URL') {
   const u=new URL(value);
   if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)throw Error(key+': gunakan HTTPS tanpa kredensial, port, query atau fragment.');
   if(key.endsWith('SUPABASE_URL')&&(!u.hostname.endsWith('.supabase.co')||u.pathname!=='/'))throw Error('URL Supabase tidak valid.');
   if(key==='BELAJAR_FUNCTION_URL'&&u.pathname!=='/api/gateway-functions')throw Error('Path wajib /api/gateway-functions.');
  }
  if(key.endsWith('_SECRET')&&value.length<32)throw Error(key+': minimal 32 karakter.');
  if(key.endsWith('_TIMEOUT_MS')&&(!/^\d+$/.test(value)||Number(value)<1000||Number(value)>(key==='WEBHOOK_TIMEOUT_MS'?60000:20000)))throw Error(key+': di luar batas.');
  if(key==='TZ')try{new Intl.DateTimeFormat('id',{timeZone:value})}catch{throw Error('Zona waktu tidak valid.');}
 }
}
let saved:Record<string,string>={};
if(fs.existsSync(file)){saved=JSON.parse(fs.readFileSync(file,'utf8'));validateEnvironment(saved);Object.assign(process.env,saved);}
export function installEnvironmentApi(app:Express,queue:()=>unknown=()=>null) {
 app.get('/api/environment/performance',(_req,res)=>res.json({success:true,mode:belajarMode(),metrics:performanceSnapshot(),queue:queue()}));
 app.get('/api/environment',(_req,res)=>res.json({success:true,fields:fields.map(f=>({...f,value:'secret' in f?'':process.env[f.key]||('fallback' in f?f.fallback:''),configured:!!process.env[f.key],source:Object.hasOwn(saved,f.key)?'dashboard':'environment/default'}))}));
 app.put('/api/environment',(req,res)=>{
  try {
   const values=req.body?.values;
   if(!values||Array.isArray(values)||typeof values!=='object')throw Error('Isi values wajib.');
   validateEnvironment(values);
   const next={...saved,...values};atomicJson(file,next);saved=next;Object.assign(process.env,values);
   res.json({success:true,message:'Tersimpan. Berlaku pada permintaan baru tanpa restart.'});
  }catch(e){res.status(400).json({success:false,error:e instanceof Error?e.message:'Gagal menyimpan.'});}
 });
 app.post('/api/environment/check',async(_req,res)=>{
  const results=[];
  let start=Date.now();
  try{await new BotStore().config();results.push({name:'Database Gateway',ok:true,ms:Date.now()-start,message:'Koneksi dan gw_config tersedia. RPC lain diuji saat menjalankan bot.'});}
  catch{results.push({name:'Database Gateway',ok:false,ms:Date.now()-start,message:'Periksa URL, service role key dan migrasi 001_bot_platform.sql.'});}
  start=Date.now();
  try{
   if(belajarMode()==='supabase_rpc'){
    const {url,key}=belajarDatabase();
    // Read-only empty result. Confirms credentials/table access, not RPC execution.
    const r=await fetch(new URL('/rest/v1/gateway_function_events?select=event_key&limit=0',url),{redirect:'error',headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000)});
    await r.body?.cancel();
    results.push({name:'Supabase Belajar langsung',ok:r.ok,ms:Date.now()-start,message:r.ok?'Koneksi dan akses tabel integrasi tersedia. Gunakan query SQL pemeriksaan untuk memastikan RPC tersedia.':`HTTP ${r.status}. Periksa key, project dan migrasi 006.`});
   }else{
   if(!process.env.BELAJAR_FUNCTION_URL||!process.env.BELAJAR_FUNCTION_SECRET)throw Error('missing');
   // Signed, deliberately invalid event: endpoint must return 400 before any business RPC.
   const r=await deliverWebhook(process.env.BELAJAR_FUNCTION_URL,process.env.BELAJAR_FUNCTION_SECRET,{probe:true});
   results.push({name:'Endpoint Belajar',ok:r.statusCode===400,ms:Date.now()-start,message:r.statusCode===400?'Endpoint dan HMAC sesuai. Pemeriksaan ini tidak menjalankan transaksi atau menguji database Belajar.':`HTTP ${r.statusCode}. 401: secret/protection; 404: URL/deploy; 5xx: server tujuan.`});
   }
  }catch{results.push({name:'Endpoint Belajar',ok:false,ms:Date.now()-start,message:'Gagal menjangkau endpoint. Periksa konfigurasi, DNS, jaringan dan batas waktu.'});}
  res.json({success:true,results});
 });
}
