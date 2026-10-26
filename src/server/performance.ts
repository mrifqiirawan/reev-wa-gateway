// Process-local bounded timings only: no phone, NISN, payload or credentials.
const samples=new Map<string,number[]>();
export function record(stage:string,ms:number){const list=samples.get(stage)||[];list.push(ms);if(list.length>500)list.shift();samples.set(stage,list)}
export async function timed<T>(stage:string,fn:()=>Promise<T>):Promise<T>{const start=performance.now();try{return await fn()}finally{record(stage,performance.now()-start)}}
export function performanceSnapshot(){return [...samples].map(([stage,list])=>{const sorted=[...list].sort((a,b)=>a-b);return {stage,count:list.length,p50:Math.round(sorted[Math.ceil(sorted.length*.5)-1]),p95:Math.round(sorted[Math.ceil(sorted.length*.95)-1])}})}
