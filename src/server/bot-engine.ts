import {generateMessageIDV2} from '@whiskeysockets/baileys';
import {type BotConfig,type BotCommand,tierOrder,validateConfig} from '../shared/bot.js';
import {BotStore} from './bot-store.js';
import {deliverWebhook} from './webhook.js';
export type Choice={id:string;title:string;description?:string};
export type BotReply={text:string;choices?:Choice[];interactive?:boolean};
export function normalizePhone(raw:string){let p=raw.replace(/[ ()-]/g,'');if(p.startsWith('0'))p='+62'+p.slice(1);else if(!p.startsWith('+'))p='+'+p;if(!/^\+[1-9]\d{7,14}$/.test(p))throw Error('Nomor WhatsApp tidak valid.');return p}
export function categoryReply(c:BotConfig,ctx:any,category?:string,page=1):BotReply{
 const header=`*${c.title}*\n${ctx.plan.name} · ${ctx.remaining} point\nReset ${String(c.resetHour).padStart(2,'0')}:00 (${c.timezone})`;
 const choices:Choice[]=category?c.commands.filter(f=>f.category===category&&f.enabled&&c.categories.some(cat=>cat.id===category&&cat.enabled)).map(f=>({id:f.command,title:f.title,description:`${f.cost} point · ${c.plans[f.minTier].name}${f.action==='belajar.register'?' · ketik + NISN':''}`})):c.categories.filter(x=>x.enabled).map(x=>({id:`.menu ${x.id}`,title:x.name}));
 if(category&&!c.categories.some(x=>x.id===category&&x.enabled))return {text:'Kategori tidak tersedia. Kirim .menu'};
 const max=Math.max(1,Math.ceil(choices.length/8)),p=Math.min(max,Math.max(1,page));
 const shown=choices.slice((p-1)*8,p*8);const items=[...shown];
 if(p<max)items.push({id:`.menu ${category||'utama'} ${p+1}`,title:'Berikutnya →'});
 if(category||p>1)items.push({id:'.menu',title:'← Menu utama'});
 return {text:header+`\n\n${category?c.categories.find(x=>x.id===category)?.name:'Pilih kategori'} · ${p}/${max}\n`+shown.map(x=>`${x.title}\n${x.id}${x.description?' · '+x.description:''}`).join('\n\n')+(shown.length?'':'Belum ada menu aktif.')+`\n\n.point · .paket`+(p<max?`\nLanjut: .menu ${category||'utama'} ${p+1}`:''),choices:items,interactive:c.presentation==='interactive'};
}
export async function callBelajar(event:string,phone:string,action:string,argument:string){
 const target=process.env.BELAJAR_FUNCTION_URL,secret=process.env.BELAJAR_FUNCTION_SECRET;
 if(!target||!secret||secret.length<32)throw Error('Integrasi REEV Belajar belum dikonfigurasi. Hubungi admin.');
 const url=new URL(target);if(url.pathname!=='/api/gateway-functions'||url.search||url.hash)throw Error('Endpoint REEV Belajar tidak valid.');
 const r=await deliverWebhook(target,secret,{id:event,timestamp:new Date().toISOString(),phone,action,argument});
 if(!r.success)throw Error('REEV Belajar sedang tidak tersedia. Coba lagi nanti.');
 let data:any;try{data=JSON.parse(r.body||'')}catch{throw Error('Respons REEV Belajar tidak valid.')}
 if(typeof data.ok!=='boolean'||typeof data.text!=='string'||!data.text.trim()||data.text.length>15000)throw Error('Respons REEV Belajar tidak valid.');return data;
}
export class BotEngine {
 private cached?:BotConfig;
 constructor(public store:BotStore,private send:(phone:string,reply:BotReply,id:string,jid:string)=>Promise<{status?:string}>,private belajar=callBelajar){}
 invalidate(){this.cached=undefined}
 async handle(input:{senderNumber:string;messageText:string;sourceMessageId:string;remoteJid:string;deviceId:string;onReply?:(text:string)=>void}):Promise<boolean>{
  if(!this.store.configured)return false;
  const words=input.messageText.trim().split(/\s+/),command=words[0]?.toLowerCase();
  if(!command?.startsWith('.')&&!['ya','batal'].includes(command))return false;
  let phone:string;try{phone=normalizePhone(input.senderNumber)}catch{return true}
  if(!/^\d+(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(input.remoteJid))return true;
  if(input.remoteJid.endsWith('@s.whatsapp.net')&&normalizePhone(input.remoteJid.split('@')[0].split(':')[0])!==phone)return true;
  let c:BotConfig;
  try{c=validateConfig((await this.store.config()).config);this.cached=c}catch(e){
   if(command.startsWith('.info')||['.menu','.point','.paket','.batal','ya','batal'].includes(command)||this.cached?.commands.some(x=>x.command===command)){
    await this.send(phone,{text:'Menu sementara tidak tersedia. Silakan coba lagi setelah admin memeriksa koneksi database.'},generateMessageIDV2(),input.remoteJid).catch(()=>{});return true;
   }
   return false;
  }
  if(!c.enabled)return false;
  // Only owned commands suppress legacy responders/webhooks.
  if(!['.menu','.point','.paket','.batal','ya','batal'].includes(command)&&!c.commands.some(f=>f.command===command))return false;
  if(['ya','batal'].includes(command)){
   if(words.length!==1)return false;
   const ctx=await this.store.rpc('gw_context',{p_phone:phone});if(!ctx.pending)return false;
  }
  const event=`${input.deviceId}:${input.remoteJid}:${input.sourceMessageId}`;
  const started=await this.store.rpc('gw_begin',{p_event:event,p_phone:phone,p_command:command});
  if(started.disabled)return false;
  if(started.duplicate||started.silent)return true;
  let reply:BotReply=started.reply;
  if(started.run){
   const ctx=started.context;c=started.config;let ok=true,pending:boolean|null=null;
   try {
    if(input.messageText.length>1000)throw Error('Perintah terlalu panjang.');
    if(command==='.menu'){const category=words[1]==='utama'?undefined:words[1];reply=categoryReply(c,ctx,category,Number.parseInt(words[2]||'1')||1)}
    else if(command==='.point')reply={text:`Sisa: ${ctx.remaining} point\nTerpakai: ${ctx.spent} · Dalam proses: ${ctx.reserved}\nPaket: ${ctx.plan.name}\nReset setiap ${String(c.resetHour).padStart(2,'0')}:00 (${c.timezone}). Point tidak diakumulasi.`};
    else if(command==='.paket')reply={text:`*Paket ${c.title}*\n`+tierOrder.map(k=>`${c.plans[k].name}: Rp${c.plans[k].price.toLocaleString('id-ID')}/bulan · ${c.plans[k].points} point/hari`).join('\n')+'\nHubungi admin untuk aktivasi/perpanjangan. Pembayaran belum otomatis.'};
    else if(['ya','batal','.batal'].includes(command)){
     const r=await this.belajar(event,phone,command==='ya'?'confirm':'cancel','');reply={text:r.text};ok=r.ok;pending=r.pending??null;
    } else {
     const f=started.function as BotCommand;
     if(f.action==='reply_text'){if(words.length>1)throw Error('Perintah ini tidak memerlukan argumen.');reply={text:f.text}}
     else {const r=await this.belajar(event,phone,f.action.slice(8),words.slice(1).join(' '));reply={text:r.text};ok=r.ok;pending=r.pending??null;}
    }
   } catch(e){ok=false;reply={text:e instanceof Error?e.message:'Fungsi gagal dijalankan. Point dikembalikan.'};}
   const finished=await this.store.rpc('gw_finish',{p_event:event,p_ok:ok,p_reply:reply,p_pending:pending});if(!finished)return true;
  }
  const id=generateMessageIDV2();if(!await this.store.rpc('gw_claim',{p_event:event,p_id:id}))return true;
  try{const r=await this.send(phone,reply,id,input.remoteJid);await this.store.rpc('gw_delivery',{p_id:id,p_status:r.status==='failed'?'failed':'sent'});if(r.status!=='failed')input.onReply?.(reply.text);}
  catch(e){await this.store.rpc('gw_delivery',{p_id:id,p_status:(e as {notSent?:boolean})?.notSent?'failed':'unknown'}).catch(()=>{});}
  return true;
 }
}
