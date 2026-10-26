import {record} from './performance.js';
// Bounded, per-chat FIFO with fair scheduling across chats. Not a durable outbox.
export class IncomingQueue {
 private jobs:{key:string;run:()=>Promise<void>;resolve:()=>void;reject:(e:unknown)=>void;at:number}[]=[];
 private active=new Set<string>();
 private rejected=0;
 constructor(private concurrency=8,private maximum=256,private maxWaitMs=30000){}
 snapshot(){return {active:this.active.size,waiting:this.jobs.length,rejected:this.rejected,concurrency:this.concurrency,capacity:this.maximum}}
 run(key:string,run:()=>Promise<void>):Promise<void>{
  if(this.jobs.length>=this.maximum){this.rejected++;return Promise.reject(Error('Antrean penuh. Coba lagi sebentar.'));}
  return new Promise((resolve,reject)=>{this.jobs.push({key,run,resolve,reject,at:Date.now()});this.pump()});
 }
 private pump(){
  while(this.active.size<this.concurrency){
   const index=this.jobs.findIndex(j=>!this.active.has(j.key));if(index<0)return;
   const job=this.jobs.splice(index,1)[0];
   if(Date.now()-job.at>this.maxWaitMs){this.rejected++;job.reject(Error('Waktu antre habis. Coba lagi sebentar.'));continue;}
   record('incoming.queue_wait',Date.now()-job.at);
   this.active.add(job.key);
   Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(()=>{this.active.delete(job.key);this.pump()});
  }
 }
}
