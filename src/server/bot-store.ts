import {timed} from './performance.js';
import type {BotConfig} from '../shared/bot.js';
export class BotStore {
 constructor(private env=process.env,private transport: typeof fetch=fetch){}
 get configured(){return !!(this.env.BOT_SUPABASE_URL&&this.env.BOT_SUPABASE_SERVICE_ROLE_KEY)}
 async request(path:string,body?:unknown,method=body===undefined?'GET':'POST'){
  if(!this.configured)throw Error('Isi BOT_SUPABASE_URL dan BOT_SUPABASE_SERVICE_ROLE_KEY di server, lalu jalankan migrasi bot.');
  const url=new URL(this.env.BOT_SUPABASE_URL!);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/')throw Error('BOT_SUPABASE_URL harus URL project https://…supabase.co.');
  const response=await this.transport(new URL('/rest/v1/'+path,url),{method,redirect:'error',headers:{apikey:this.env.BOT_SUPABASE_SERVICE_ROLE_KEY!,Authorization:`Bearer ${this.env.BOT_SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(Number(this.env.BOT_DB_TIMEOUT_MS)||12000)});
  if(!response.ok)throw Error(response.status===409?'Konflik data. Muat ulang dan coba lagi.':'Database bot belum siap atau permintaan gagal. Periksa migrasi dan konfigurasi server.');
  return response.status===204?null:response.json();
 }
 rpc(name:string,args:Record<string,unknown>={}){return timed('gateway.'+name,()=>this.request('rpc/'+name,args))}
 async config():Promise<{config:BotConfig;revision:number}>{const rows=await timed('gateway.config',()=>this.request('gw_config?id=eq.true&select=config,revision'));if(!rows?.[0])throw Error('Migrasi bot belum diterapkan.');return rows[0]}
}
