import {deliverWebhook} from './webhook.js';
import {timed} from './performance.js';
export const belajarMode=()=>process.env.BELAJAR_TRANSPORT||'webhook';
export const belajarConfigured=()=>belajarMode()==='supabase_rpc'?!!(process.env.BELAJAR_SUPABASE_URL&&process.env.BELAJAR_SUPABASE_SERVICE_ROLE_KEY):!!(process.env.BELAJAR_FUNCTION_URL&&process.env.BELAJAR_FUNCTION_SECRET);
export function belajarDatabase(){
 const u=new URL(process.env.BELAJAR_SUPABASE_URL||'');
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!u.hostname.endsWith('.supabase.co'))throw Error('BELAJAR_SUPABASE_URL harus URL project Supabase HTTPS.');
 const key=process.env.BELAJAR_SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error('Isi service role key database Belajar di Environment Variables.');
 return {url:u,key};
}
export async function directBelajar(args:Record<string,unknown>,transport:typeof fetch=fetch){
 const {url,key}=belajarDatabase();
 const timeout=Math.max(1000,Math.min(20000,Number(process.env.BOT_DB_TIMEOUT_MS)||12000));
 let response:Response;
 try{response=await transport(new URL('/rest/v1/rpc/reev_gateway_function',url),{method:'POST',redirect:'error',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(timeout)});}
 catch{throw Error('Koneksi Supabase Belajar gagal/batas waktu tercapai. Hasil proses belum diketahui; periksa sebelum mengulang.');}
 if(!response.ok){await response.body?.cancel();throw Error(`Supabase Belajar HTTP ${response.status}. Periksa service role key, fungsi RPC dan koneksi database.`)}
 return response.json();
}
export async function callBelajar(event:string,phone:string,action:string,argument:string){
 if(!event||event.length>300||!/^\+[1-9]\d{7,14}$/.test(phone)||!['register','confirm','cancel','profile','tasks','grades','stars','hearts','attendance'].includes(action)||argument.length>30)throw Error('Parameter perintah Belajar tidak valid.');
 const mode=belajarMode();
 const data=await timed('belajar.'+mode,async()=>{
  if(mode==='supabase_rpc')return directBelajar({p_event:event,p_phone:phone,p_action:action,p_argument:argument});
  if(mode!=='webhook')throw Error('BELAJAR_TRANSPORT tidak valid.');
  const target=process.env.BELAJAR_FUNCTION_URL,secret=process.env.BELAJAR_FUNCTION_SECRET;
  if(!target||!secret||secret.length<32)throw Error('Integrasi REEV Belajar belum dikonfigurasi. Hubungi admin.');
  const u=new URL(target);if(u.pathname!=='/api/gateway-functions'||u.search||u.hash)throw Error('Endpoint REEV Belajar tidak valid.');
  const r=await deliverWebhook(target,secret,{id:event,timestamp:new Date().toISOString(),phone,action,argument});
  if(!r.success)throw Error(`REEV Belajar merespons HTTP ${r.statusCode}. Periksa URL, secret dan deployment.`);
  try{return JSON.parse(r.body||'')}catch{throw Error('Respons REEV Belajar tidak valid.')}
 });
 if(typeof data?.ok!=='boolean'||typeof data.text!=='string'||!data.text.trim()||data.text.length>15000)throw Error('Respons REEV Belajar tidak valid.');return data;
}
