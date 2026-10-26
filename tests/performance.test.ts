import test from 'node:test';import assert from 'node:assert/strict';
import {IncomingQueue} from '../src/server/incoming-queue.js';import {BotEngine} from '../src/server/bot-engine.js';import {defaultBotConfig} from '../src/shared/bot.js';import {directBelajar,callBelajar} from '../src/server/belajar-client.js';
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
test('queue keeps per-chat FIFO across batches while another chat completes, limits concurrency and rejects overflow',async()=>{
 const q=new IncomingQueue(2,2);const hold=gate();const order:string[]=[];let active=0,max=0;
 const first=q.run('a',async()=>{active++;max=Math.max(max,active);order.push('a1');await hold.promise;active--;});
 const second=q.run('a',async()=>{order.push('a2')});
 const other=q.run('b',async()=>{active++;max=Math.max(max,active);order.push('b');active--});
 await other;assert.ok(!order.includes('a2'));assert.ok(order.includes('b'));await tick();
 const third=q.run('a',async()=>{order.push('a3')});await assert.rejects(q.run('a',async()=>{}),/penuh/);
 hold.resolve();await Promise.all([first,second,third]);assert.deepEqual(order,['a1','b','a2','a3']);assert.ok(max<=2);
 await tick();assert.equal(q.snapshot().active,0);assert.equal(q.snapshot().rejected,1);
});
test('queue releases failed job and expires waiting jobs without executing them',async()=>{
 const q=new IncomingQueue(1,3,5);const hold=gate();let ran=false;
 const a=q.run('a',async()=>{await hold.promise;throw Error('failure')});const failure=assert.rejects(a,/failure/);
 const b=q.run('b',async()=>{ran=true});const expiry=assert.rejects(b,/Waktu antre/);
 await new Promise(r=>setTimeout(r,15));hold.resolve();await Promise.all([failure,expiry]);assert.equal(ran,false);await tick();await q.run('c',async()=>{ran=true});assert.ok(ran);
});
test('burst shares config fetch; quota/deduplication still checked on every command; invalidate reloads',async()=>{
 const config=structuredClone(defaultBotConfig);config.enabled=true;let reads=0,begins=0,functions=0;const seen=new Set<string>();
 const store:any={configured:true,config:async()=>{reads++;await tick();return {config}},rpc:async(name:string,args:any)=>{
  if(name==='gw_begin'){begins++;if(seen.has(args.p_event))return {duplicate:true};seen.add(args.p_event);return {run:true,config,context:{},function:config.commands[0]};}return true;
 }};
 const e=new BotEngine(store,async()=>({status:'sent'}),async()=>{functions++;return {ok:true,text:'confirmed',pending:true}});
 const msg=(i:number)=>({senderNumber:'628123456789',remoteJid:'628123456789@s.whatsapp.net',deviceId:'device_primary',sourceMessageId:String(i),messageText:'.infodaftar 0012345671'});
 await Promise.all(Array.from({length:32},(_,i)=>e.handle(msg(i))));assert.equal(reads,1);assert.equal(begins,32);assert.equal(functions,32);
 await e.handle(msg(0));assert.equal(functions,32);assert.equal(begins,33);
 e.invalidate();await e.handle(msg(33));assert.equal(reads,2);
});
test('direct RPC uses same event, phone, NISN with no redirect/retry or HTTP fallback',async()=>{
 const old={...process.env};const native=fetch;
 try{
 process.env.BELAJAR_TRANSPORT='supabase_rpc';process.env.BELAJAR_SUPABASE_URL='https://example.supabase.co';process.env.BELAJAR_SUPABASE_SERVICE_ROLE_KEY='fixture-service-key';let calls=0;
 globalThis.fetch=(async(url:any,opts:any)=>{calls++;assert.equal(String(url),'https://example.supabase.co/rest/v1/rpc/reev_gateway_function');assert.equal(opts.redirect,'error');assert.equal(opts.headers.apikey,'fixture-service-key');assert.deepEqual(JSON.parse(opts.body),{p_event:'event-1',p_phone:'+628123456789',p_action:'register',p_argument:'0012345671'});return Response.json({ok:true,text:'Konfirmasi',pending:true})}) as any;
 assert.equal((await callBelajar('event-1','+628123456789','register','0012345671')).pending,true);assert.equal(calls,1);
 globalThis.fetch=(async()=>{calls++;throw Error('private backend error')}) as any;await assert.rejects(callBelajar('event-1','+628123456789','register','0012345671'),/Hasil proses belum diketahui/);assert.equal(calls,2);
 globalThis.fetch=(async()=>Response.json({message:'secret-in-error'},{status:401})) as any;await assert.rejects(callBelajar('event-1','+628123456789','register','0012345671'),/HTTP 401/);
 process.env.BELAJAR_SUPABASE_URL='https://example.supabase.co.attacker.test';await assert.rejects(directBelajar({}),/URL project/);
 }finally{globalThis.fetch=native;for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});
