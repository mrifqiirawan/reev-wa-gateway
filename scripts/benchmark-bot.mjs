// Synthetic local scheduling experiment, never contacts Supabase or WhatsApp.
import {IncomingQueue} from '../src/server/incoming-queue.ts';
import {BotEngine} from '../src/server/bot-engine.ts';
import {defaultBotConfig} from '../src/shared/bot.ts';
const delay=()=>new Promise(r=>setTimeout(r,15));
async function run(concurrency){
 const config=structuredClone(defaultBotConfig);config.enabled=true;let reads=0;
 const store={configured:true,async config(){reads++;await delay();return {config}},async rpc(name){await delay();if(name==='gw_begin')return {run:true,config,context:{},function:config.commands[0]};return true;}};
 const engine=new BotEngine(store,async()=>{await delay();return {status:'sent'}},async()=>{await delay();return {ok:true,text:'Synthetic confirmation',pending:true}});
 const queue=new IncomingQueue(concurrency,256,30000);const times=[];const start=performance.now();
 await Promise.all(Array.from({length:64},(_,i)=>queue.run(String(i),async()=>{const phone='62810000'+String(i).padStart(4,'0');await engine.handle({senderNumber:phone,remoteJid:phone+'@s.whatsapp.net',sourceMessageId:'fixture-'+i,deviceId:'fixture',messageText:'.infodaftar 0012345671'});times.push(performance.now()-start)})));
 times.sort((a,b)=>a-b);return {concurrency,messages:64,configReads:reads,totalMs:Math.round(performance.now()-start),completionP50Ms:Math.round(times[31]),completionP95Ms:Math.round(times[60])};
}
console.log(JSON.stringify({scope:'SYNTHETIC: fixed 15 ms mock I/O per step. Both modes use the revised engine. Compares queue concurrency only; not real students/WA/Supabase or a production capacity guarantee.',results:[await run(1),await run(8)]},null,2));
