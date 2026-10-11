import https from 'node:https';
import { lookup } from 'node:dns/promises';
import crypto from 'node:crypto';
export async function deliverWebhook(url: string, secret: string, payload: unknown, dependencies = { lookup, request: https.request }) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password || (target.port && target.port !== '443')) throw new Error('Webhook harus URL HTTPS publik port 443 tanpa kredensial.');
  const addresses = await dependencies.lookup(target.hostname, { all: true, family: 4 });
  const privateIP = (ip: string) => {
    const [a,b] = ip.split('.').map(Number);
    return a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0)) || (a===100&&b>=64&&b<=127) || (a===198&&(b===18||b===19));
  };
  if (!addresses.length || addresses.some(a=>privateIP(a.address))) throw new Error('Alamat webhook privat/reserved ditolak.');
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return new Promise<{success:boolean;statusCode:number}>((resolve,reject)=>{
    const req = dependencies.request(target, {method:'POST', family: 4, lookup: (_host: any, options: any, cb: any) => options.all ? cb(null, [addresses[0]]) : cb(null, addresses[0].address, 4), headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'X-REEV-Signature':'sha256='+signature}}, res=>{
      res.resume(); resolve({success: !!res.statusCode && res.statusCode>=200 && res.statusCode<300, statusCode:res.statusCode || 0});
    });
    const timer=setTimeout(()=>req.destroy(new Error('Webhook timeout (10 detik).')),10000);
    req.on('close',()=>clearTimeout(timer)); req.on('error',reject); req.end(body);
  });
}
