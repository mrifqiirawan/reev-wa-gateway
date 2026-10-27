import {record} from './src/server/performance.js';
import {installEnvironmentApi} from './src/server/environment.js';
import {BotStore} from './src/server/bot-store.js';
import {BotEngine,type BotReply} from './src/server/bot-engine.js';
import {installBotApi} from './src/server/bot-api.js';
import 'dotenv/config';
import { advanceReceipt, finishSend, failSend } from './src/server/message-status.js';
import { deliverWebhook } from './src/server/webhook.js';
import { atomicJson } from './src/server/auth.js';
import { installAuth } from './src/server/auth.js';
import express, { Request, Response } from 'express';
import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';
import { baileysManager, type BaileysDeviceState } from './src/server/baileys.js';
import { createProjectZip } from './src/server/zip_packager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==========================================
// ZERO-DUMMY REAL PRODUCTION DATA STORE
// ==========================================

export interface MessageLogData {
  id: string;
  recipient: string;
  recipientName?: string;
  content: string;
  type: 'text' | 'media' | 'otp' | 'broadcast' | 'auto_reply';
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  deviceId: string;
}

export interface InboxMessageData {
  sourceMessageId?: string;
  remoteJid?: string;
  id: string;
  senderNumber: string;
  senderName: string;
  messageText: string;
  timestamp: string;
  matchedRuleId?: string;
  matchedKeyword?: string;
  botReplyText?: string;
  status: 'replied' | 'fallback_replied' | 'forwarded_webhook' | 'ignored';
  deviceId: string;
}

export interface AutoResponderRuleData {
  id: string;
  title: string;
  matchType: 'exact' | 'contains' | 'regex' | 'starts_with';
  keywords: string[];
  replyMessage: string;
  isEnabled: boolean;
  priority: number;
  triggerCount: number;
  lastTriggered?: string;
  actionType: 'reply_text' | 'reply_menu' | 'forward_webhook';
  webhookUrl?: string;
}

// Zero-Dummy: Clean empty message logs and inbox
const messageLogs: MessageLogData[] = [];
const inboxMessages: InboxMessageData[] = [];

// Clean starter Auto-Responder Rules (Ready for business use)
const autoResponderRules: AutoResponderRuleData[] = [
  {
    id: 'rule_menu',
    title: 'Menu Utama & Bantuan',
    matchType: 'exact',
    keywords: ['menu', 'halo', 'hi', 'bantuan', 'start', 'p'],
    replyMessage: `Halo {sender_name}! {greeting} 🙏\n\nSelamat datang di Layanan Otomatis *REEV WA Gateway*.\nSilakan pilih menu bantuan berikut:\n\n1️⃣ Cek Status Pesanan / Transaksi\n2️⃣ Permintaan Kode OTP / Verifikasi\n3️⃣ Informasi Integrasi API & Webhook\n4️⃣ Hubungi Customer Support\n\nKetik angka *1*, *2*, *3*, atau *4* untuk melanjutkan.`,
    isEnabled: true,
    priority: 1,
    triggerCount: 0,
    actionType: 'reply_menu',
  },
  {
    id: 'rule_order',
    title: 'Menu 1: Status Transaksi',
    matchType: 'contains',
    keywords: ['1', 'cek pesanan', 'status transaksi'],
    replyMessage: `Halo {sender_name},\n\nUntuk melacak status pesanan Anda, silakan ketik format:\n*ORDER#NomorInvoice*\nContoh: *ORDER#INV-2026-9901*\n\nSistem REEV Gateway akan otomatis mengambil data terkini dari backend.`,
    isEnabled: true,
    priority: 2,
    triggerCount: 0,
    actionType: 'reply_text',
  },
  {
    id: 'rule_otp',
    title: 'Menu 2: Layanan OTP',
    matchType: 'contains',
    keywords: ['2', 'otp', 'kode verifikasi'],
    replyMessage: `Layanan OTP REEV WA Gateway beroperasi dengan latency < 350ms.\nPastikan nomor handphone yang terdaftar dalam kondisi aktif.\n\nJika Anda membutuhkan API Key untuk pengiriman OTP massal, silakan cek menu *API & Webhook* di dashboard.`,
    isEnabled: true,
    priority: 3,
    triggerCount: 0,
    actionType: 'reply_text',
  },
  {
    id: 'rule_cs',
    title: 'Menu 4: Hubungi Customer Service',
    matchType: 'contains',
    keywords: ['4', 'cs', 'admin', 'bantuan manusia'],
    replyMessage: `Pesan Anda telah diteruskan ke Customer Support kami.\nPetugas kami akan segera merespons dalam jam kerja (08.00 - 17.00 WIB).\n\nTerima kasih atas kesabaran Anda, {sender_name}!`,
    isEnabled: true,
    priority: 4,
    triggerCount: 0,
    actionType: 'reply_text',
  }
];

let fallbackConfig = {
  isEnabled: true,
  replyMessage: `Mohon maaf {sender_name}, pesan yang Anda kirimkan belum dikenali oleh sistem kami.\n\nKetik *MENU* untuk melihat daftar opsi bantuan, atau ketik *CS* untuk terhubung langsung dengan tim kami.`,
  delayMs: 800
};

let webhookConfig = {
  url: '',
  secretKey: 'reev_whsec_' + crypto.randomBytes(16).toString('hex'),
  isEnabled: false,
  events: {
    onMessageReceived: true,
    onMessageSent: true,
    onMessageDelivered: true,
    onMessageFailed: true,
    onDeviceStatusChanged: true,
  },
  retryAttempts: 3,
  lastPayload: undefined as string | undefined,
  lastResponseCode: 200,
  lastTestedAt: undefined as string | undefined
};

const stateFile = path.resolve(process.env.DATA_DIR || 'sessions', 'gateway_state.json');
if (fs.existsSync(stateFile)) {
  const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  messageLogs.push(...(saved.messageLogs || [])); inboxMessages.push(...(saved.inboxMessages || []));
  autoResponderRules.splice(0, autoResponderRules.length, ...(saved.rules || []));
  fallbackConfig = saved.fallback || fallbackConfig; webhookConfig = saved.webhook || webhookConfig;
}
function persist() { const start=performance.now();try{atomicJson(stateFile, {messageLogs,inboxMessages,rules:autoResponderRules,fallback:fallbackConfig,webhook:webhookConfig});}finally{record('disk.persist',performance.now()-start)} }
async function dispatch(event: string, data: unknown, force = false, target?: string) {
  const flags: Record<string, keyof typeof webhookConfig.events> = {'message.received':'onMessageReceived','message.sent':'onMessageSent','message.delivered':'onMessageDelivered','message.failed':'onMessageFailed','device.status':'onDeviceStatusChanged'};
  if (!force && (!webhookConfig.isEnabled || !webhookConfig.events[flags[event]])) return {success:false, skipped:true};
  const payload = {id:crypto.randomUUID(),event,timestamp:new Date().toISOString(),deviceId:'device_primary',data};
  webhookConfig.lastPayload = JSON.stringify(payload); webhookConfig.lastTestedAt = payload.timestamp;
  try { const result = await deliverWebhook(target || webhookConfig.url, webhookConfig.secretKey, payload); webhookConfig.lastResponseCode=result.statusCode; persist(); return {...result,payload}; }
  catch(e) { webhookConfig.lastResponseCode=0; persist(); return {success:false,statusCode:0,error:String(e),payload}; }
}
async function sendReal(recipient: unknown, message: unknown, type: MessageLogData['type']='text', deviceId = 'device_primary', remoteJid?: string, options?: {messageId?:string;choices?:import('./src/server/bot-engine.js').Choice[]}) {
  if (deviceId !== 'device_primary') throw new Error('deviceId tidak dikenal. Gunakan device_primary.');
  let phone=String(recipient || '').replace(/[^0-9]/g,''); if(phone.startsWith('0')) phone='62'+phone.slice(1);
  if((!remoteJid && !/^[1-9][0-9]{7,14}$/.test(phone)) || typeof message !== 'string' || !message.trim() || message.length>16000) throw new Error('Nomor/pesan tidak valid (maksimum 16000 karakter).');
  const log: MessageLogData={id:crypto.randomUUID(),recipient:remoteJid?.endsWith('@g.us')?remoteJid:phone || remoteJid!,content:message,type,status:'sending',timestamp:new Date().toISOString(),latencyMs:0,retryCount:0,deviceId};
  messageLogs.unshift(log); persist();
  try { const result=await baileysManager.sendTextMessage(phone,message,id=>{log.id=id;persist();},remoteJid,options); Object.assign(log,result,{id:result.messageId}); finishSend(log); persist(); if(log.status === 'failed') throw new Error(log.errorMessage || 'WhatsApp menolak pesan.'); void dispatch('message.sent',log); return {success:true,...result,status:log.status,recipient:log.recipient}; }
  catch(e) { failSend(log,log.errorCode || 'SEND_ERROR',log.errorMessage || String(e)); persist(); void dispatch('message.failed',log); throw e; }
}


// Helper: Calculate Indonesian Greeting
function getIndonesianGreeting(hour?: number): string {
  const currentHour = hour !== undefined ? hour : new Date().getHours();
  if (currentHour >= 4 && currentHour < 11) return 'Selamat Pagi';
  if (currentHour >= 11 && currentHour < 15) return 'Selamat Siang';
  if (currentHour >= 15 && currentHour < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

// Helper: Interpolate Dynamic Variables
function interpolateTemplate(template: string, senderName: string, senderNumber: string): string {
  const now = new Date();
  const greeting = getIndonesianGreeting(now.getHours());
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return template
    .replace(/\{sender_name\}/gi, senderName || 'Pelanggan')
    .replace(/\{nama\}/gi, senderName || 'Pelanggan')
    .replace(/\{sender_number\}/gi, senderNumber)
    .replace(/\{greeting\}/gi, greeting)
    .replace(/\{salam\}/gi, greeting)
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{jam\}/gi, timeStr)
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{tanggal\}/gi, dateStr);
}

// Helper: Match rule
function findMatchingRule(text: string): { rule: AutoResponderRuleData; matchedKeyword: string } | null {
  const cleanText = String(text).slice(0,16000).trim().toLowerCase();

  const activeRules = [...autoResponderRules]
    .filter(r => r.isEnabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of activeRules) {
    for (const kw of rule.keywords) {
      const keyword = kw.trim().toLowerCase();
      if (!keyword) continue;

      if (rule.matchType === 'exact' && cleanText === keyword) {
        return { rule, matchedKeyword: kw };
      }
      if (rule.matchType === 'contains' && cleanText.includes(keyword)) {
        return { rule, matchedKeyword: kw };
      }
      if (rule.matchType === 'starts_with' && cleanText.startsWith(keyword)) {
        return { rule, matchedKeyword: kw };
      }

    }
  }

  return null;
}

const botStore = new BotStore();
const botEngine = new BotEngine(botStore,async(phone,reply,id,jid)=>{
 if(baileysManager.getDeviceState().status!=='connected')throw Object.assign(new Error('WhatsApp belum terhubung.'),{notSent:true});
 return sendReal(phone,reply.text,'auto_reply','device_primary',jid,{messageId:id,choices:reply.interactive?reply.choices:undefined});
});
const botRecovery=setInterval(()=>{if(botStore.configured)void botStore.rpc('gw_recover').catch(()=>{});},60000);botRecovery.unref();
baileysManager.setOutgoingMessageLookup(id=>messageLogs.find(row=>row.id===id)?.content);
baileysManager.setFailureHandler((id,code,message)=>{
  if(botStore.configured)void botStore.rpc('gw_delivery',{p_id:id,p_status:'failed'}).catch(()=>{});
  const row=messageLogs.find(l=>l.id===id);
  if(row && failSend(row,code,message)){persist();void dispatch('message.failed',row);}
});
baileysManager.setReceiptHandler((id,status)=>{if(botStore.configured)void botStore.rpc('gw_delivery',{p_id:id,p_status:status}).catch(()=>{});const row=messageLogs.find(l=>l.id===id);if(row && advanceReceipt(row,status)){persist();void dispatch('message.delivered',row);}});
baileysManager.setStatusHandler(status=>{void dispatch('device.status',{status});if(status==='connected')void drainBulk();});
// Incoming messages are recorded even when automatic replies are disabled.
baileysManager.setIncomingMessageHandler(async ({senderNumber,senderName,messageText,remoteJid,messageId,timestamp,allowAutoReply})=>{
  if(inboxMessages.some(row=>row.sourceMessageId===messageId && row.remoteJid===remoteJid && row.senderNumber===senderNumber)) return null;
  const match=findMatchingRule(messageText);
  const row: InboxMessageData={id:crypto.randomUUID(),sourceMessageId:messageId,remoteJid,senderNumber,senderName,messageText,timestamp,status:'ignored',deviceId:'device_primary'};
  inboxMessages.unshift(row); persist();
  if(allowAutoReply){
    try{if(await botEngine.handle({senderNumber,messageText,sourceMessageId:messageId,remoteJid,deviceId:'device_primary',onReply:text=>{row.botReplyText=text}})){row.status=row.botReplyText?'replied':'ignored';persist();return null;}}
    catch{console.error('Custom bot processing failed; periksa koneksi/migrasi bot.');return null;}
  }
  if(remoteJid.endsWith('@g.us'))return null; // Groups never reach legacy webhook/fallback responders.
  void dispatch('message.received',row);
  if(!allowAutoReply) return null;
  let reply='';
  if(match) {
    match.rule.triggerCount++; match.rule.lastTriggered=new Date().toISOString(); row.matchedRuleId=match.rule.id; row.matchedKeyword=match.matchedKeyword;
    if(match.rule.actionType==='forward_webhook') { const result=await dispatch('message.received',row,true,match.rule.webhookUrl); if(result.success) row.status='forwarded_webhook'; persist(); return null; }
    reply=interpolateTemplate(match.rule.replyMessage,senderName,senderNumber);
  } else if(fallbackConfig.isEnabled) reply=interpolateTemplate(fallbackConfig.replyMessage,senderName,senderNumber);
  if(reply) { try { if(!match&&fallbackConfig.delayMs)await new Promise(r=>setTimeout(r,fallbackConfig.delayMs)); await sendReal(senderNumber,reply,'auto_reply','device_primary',remoteJid); row.status=match?'replied':'fallback_replied'; row.botReplyText=reply; } catch(e) { console.error('Auto reply failed:',String(e)); } }
  persist(); return null;
});

// ==========================================
// REST API ROUTES (/api/*)
// ==========================================

// Persistent auth lives on the single always-on backend.
installAuth(app, path.resolve(process.env.DATA_DIR || 'sessions'));
installEnvironmentApi(app,()=>baileysManager.incomingQueueStats());
installBotApi(app,botStore,botEngine);

// 1. System Status
app.get('/api/status', (_req: Request, res: Response) => {
  const devState = baileysManager.getDeviceState();
  res.json({
    success: true,
    app: 'REEV WA Gateway',
    version: '2.8.4',
    engine: 'Baileys Multi-Device (unofficial)',
    uptime: process.uptime(),
    activeDevices: devState.status === 'connected' ? 1 : 0,
    deviceStatus: devState.status,
    timestamp: new Date().toISOString()
  });
});

// 2. Devices Management
app.get('/api/devices', (_req: Request, res: Response) => {
  const dev = baileysManager.getDeviceState();
  res.json({ success: true, devices: [dev] });
});

app.post('/api/devices/init-baileys', async (_req: Request, res: Response) => {
  try {
    await baileysManager.initSocket();
    const dev = baileysManager.getDeviceState();
    res.json({ success: true, device: dev });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMsg });
  }
});

app.post('/api/devices/create', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    await baileysManager.initSocket();

    let pairingCode: string | undefined;
    if (phone) {
      pairingCode = await baileysManager.requestPairingCode(phone);
    }

    const dev = baileysManager.getDeviceState();
    if (pairingCode) dev.pairingCode = pairingCode;

    res.json({ success: true, device: dev });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMsg });
  }
});

app.post('/api/devices/:id/reconnect', async (_req: Request, res: Response) => {
  try {
    await baileysManager.reconnect();
    const dev = baileysManager.getDeviceState();
    res.json({ success: true, device: dev, message: 'Reconnection sequence initiated' });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: errorMsg });
  }
});

app.delete('/api/devices/:id', async (_req: Request, res: Response, next) => {
  try {
    await baileysManager.disconnect();
    res.json({ success: true, message: 'Session disconnected and reset' });
  } catch (err) { next(err); }
});

// Real transport only: never claim delivery before a receipt.
app.post('/api/messages/send', async (req,res)=>{
  try { res.json(await sendReal(req.body.recipient,req.body.message,'text',req.body.deviceId)); }
  catch(e) {res.status(503).json({success:false,error:String(e)});}
});
app.post('/api/messages/send-otp',async(req,res)=>{
  if(!req.body.otpCode) return res.status(400).json({success:false,error:'otpCode wajib diisi.'});
  const {recipient,otpCode,serviceName='Akun Anda',expiresInMinutes=5}=req.body;
  try {res.json(await sendReal(recipient,`Kode verifikasi ${serviceName}: *${otpCode}*. Berlaku ${expiresInMinutes} menit. Jangan bagikan kode ini.`, 'otp'));}
  catch(e) {res.status(503).json({success:false,error:String(e)});}
});
// Persist queued jobs before returning; process one message at a time.
let bulkRunning=false;
async function drainBulk() {
  if(bulkRunning) return; bulkRunning=true;
  try {
    for(const log of messageLogs.filter(l=>l.status==='queued' && l.type==='broadcast').reverse()) {
      log.status='sending';persist();
      try {const result=await baileysManager.sendTextMessage(log.recipient,log.content,id=>{log.id=id;persist();}); log.id=result.messageId;log.latencyMs=result.latencyMs;finishSend(log);if(String(log.status) !== 'failed')void dispatch('message.sent',log);}
      catch(e) {failSend(log,log.errorCode || 'SEND_ERROR',log.errorMessage || String(e));void dispatch('message.failed',log);}
      persist(); await new Promise(r=>setTimeout(r,4000+Math.random()*4000));
    }
  } finally {bulkRunning=false;if(baileysManager.getDeviceState().status==='connected'&&messageLogs.some(l=>l.status==='queued'&&l.type==='broadcast'))void drainBulk();}
}
// An interrupted send has an uncertain outcome. Do not retry it automatically.
for(const log of messageLogs) if(log.status==='sending') {log.status='failed';log.errorMessage='Proses terputus; periksa penerima sebelum mencoba ulang.';}
app.post('/api/messages/bulk',(req,res)=>{
  const {contacts,template}=req.body;
  if(!Array.isArray(contacts)||!contacts.length||contacts.length>500||typeof template!=='string'||!template.trim()) return res.status(400).json({success:false,error:'Isi template dan 1–500 kontak.'});
  if(baileysManager.getDeviceState().status!=='connected') return res.status(503).json({success:false,error:'Hubungkan WhatsApp dahulu.'});
  const campaignId=crypto.randomUUID();
  const rows: MessageLogData[]=[];
  for(const [i,c] of contacts.entries()) {
    let phone=String(c.phone||'').replace(/[^0-9]/g,'');if(phone.startsWith('0'))phone='62'+phone.slice(1);
    if(!/^[1-9][0-9]{7,14}$/.test(phone)) return res.status(400).json({success:false,error:`Nomor kontak ${i+1} tidak valid.`});
    let content=template.replace(/\{nama\}/gi,()=>String(c.name||'Pelanggan'));
    for(const [k,v] of Object.entries(c.params||{})) content=content.split('{'+k+'}').join(String(v));
    if(content.length>16000) return res.status(400).json({success:false,error:'Template terlalu panjang.'});
    rows.push({id:`${campaignId}_${i}`,recipient:phone,content,type:'broadcast',status:'queued',timestamp:new Date().toISOString(),latencyMs:0,retryCount:0,deviceId:'device_primary'});
  }
  messageLogs.unshift(...rows);persist();res.json({success:true,campaignId,totalContacts:rows.length,queuedCount:rows.length,status:'queued',delayRange:'4s - 8s'});void drainBulk();
});

function validateRule(rule: AutoResponderRuleData) {
  if(typeof rule.title!=='string'||!rule.title.trim()||rule.title.length>200) throw new Error('Judul aturan tidak valid.');
  if(!['exact','contains','starts_with'].includes(rule.matchType)) throw new Error('Mode pencocokan tidak didukung.');
  if(!Array.isArray(rule.keywords)||!rule.keywords.length||rule.keywords.length>50||rule.keywords.some(k=>typeof k!=='string'||k.length>200)) throw new Error('Kata kunci tidak valid.');
  if(typeof rule.replyMessage!=='string'||rule.replyMessage.length>16000||typeof rule.isEnabled!=='boolean'||!Number.isFinite(rule.priority)) throw new Error('Isi aturan tidak valid.');
  if(!['reply_text','reply_menu','forward_webhook'].includes(rule.actionType)) throw new Error('Aksi tidak didukung.');
  if(rule.actionType==='forward_webhook' && (!rule.webhookUrl || new URL(rule.webhookUrl).protocol!=='https:')) throw new Error('Isi URL webhook HTTPS.');
}
// 6. Auto-Responder Rules
app.get('/api/auto-responder/rules', (_req: Request, res: Response) => {
  res.json({
    success: true,
    rules: autoResponderRules,
    fallback: fallbackConfig
  });
});

app.post('/api/auto-responder/rules', (req: Request, res: Response) => {
  const { title, matchType, keywords, replyMessage, actionType, webhookUrl } = req.body;
  if(matchType==='regex') return res.status(400).json({success:false,error:'Gunakan exact, contains, atau starts_with; regex dinonaktifkan untuk mencegah server macet.'});

  if (!title || !keywords || !replyMessage) {
    return res.status(400).json({ success: false, error: 'Title, keywords, dan replyMessage wajib diisi' });
  }

  const newRule: AutoResponderRuleData = {
    id: 'rule_' + Date.now().toString(36),
    title,
    matchType: matchType || 'contains',
    keywords: Array.isArray(keywords) ? keywords : [keywords],
    replyMessage,
    isEnabled: true,
    priority: autoResponderRules.length + 1,
    triggerCount: 0,
    actionType: actionType || 'reply_text',
    webhookUrl: webhookUrl || undefined
  };

  try {validateRule(newRule);} catch(e) {return res.status(400).json({success:false,error:String(e)});}
  autoResponderRules.push(newRule);
  persist();
  res.json({ success: true, rule: newRule });
});

app.put('/api/auto-responder/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = autoResponderRules.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Rule tidak ditemukan' });
  }

  if(req.body.matchType==='regex') return res.status(400).json({success:false,error:'Regex tidak didukung.'});
  const allowed=['title','matchType','keywords','replyMessage','isEnabled','priority','actionType','webhookUrl'];
  const patch=Object.fromEntries(Object.entries(req.body).filter(([key])=>allowed.includes(key)));
  const nextRule={...autoResponderRules[index],...patch};
  try {validateRule(nextRule);} catch(e) {return res.status(400).json({success:false,error:String(e)});}
  autoResponderRules[index]=nextRule;
  persist();

  res.json({ success: true, rule: autoResponderRules[index] });
});

app.delete('/api/auto-responder/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = autoResponderRules.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Rule tidak ditemukan' });
  }
  autoResponderRules.splice(index, 1);
  persist();
  res.json({ success: true, message: 'Rule berhasil dihapus' });
});

app.post('/api/auto-responder/fallback', (req: Request, res: Response) => {
  const { isEnabled, replyMessage, delayMs } = req.body;
  if((isEnabled!==undefined&&typeof isEnabled!=='boolean')||(replyMessage!==undefined&&(typeof replyMessage!=='string'||replyMessage.length>16000))||(delayMs!==undefined&&(!Number.isFinite(delayMs)||delayMs<0||delayMs>10000)))return res.status(400).json({success:false,error:'Fallback tidak valid.'});
  fallbackConfig = {
    ...fallbackConfig,
    ...(isEnabled !== undefined && { isEnabled }),
    ...(replyMessage !== undefined && { replyMessage }),
    ...(delayMs !== undefined && { delayMs })
  };
  persist();
  res.json({ success: true, fallback: fallbackConfig });
});

// 7. Auto-Responder Live Simulator
app.post('/api/auto-responder/simulate', (req: Request, res: Response) => {
  const { senderNumber, senderName, incomingMessage } = req.body;

  if (!incomingMessage) {
    return res.status(400).json({ success: false, error: 'Pesan masuk wajib diisi' });
  }

  const phone = senderNumber || '6281234567890';
  const name = senderName || 'Pengguna Simulasi';

  const matchResult = findMatchingRule(incomingMessage);
  let replyText = '';
  let status: 'replied' | 'fallback_replied' | 'forwarded_webhook' = 'replied';
  let matchedRuleId: string | undefined;
  let matchedKeyword: string | undefined;

  if (matchResult) {
    const { rule, matchedKeyword: kw } = matchResult;

    matchedRuleId = rule.id;
    matchedKeyword = kw;
    replyText = interpolateTemplate(rule.replyMessage, name, phone);
    if (rule.actionType === 'forward_webhook') {
      status = 'forwarded_webhook';
    }
  } else if (fallbackConfig.isEnabled) {
    status = 'fallback_replied';
    replyText = interpolateTemplate(fallbackConfig.replyMessage, name, phone);
  } else {
    return res.json({
      success: true,
      matched: false,
      replyText: null,
      message: 'Tidak ada aturan yang cocok'
    });
  }

  res.json({
    success: true,
    matched: !!matchResult,
    matchedRuleId,
    matchedKeyword,
    status,
    replyText,
    simulation: true
  });
});

// 8. Inbox Feed
app.get('/api/inbox', (_req: Request, res: Response) => {
  res.json({ success: true, inbox: inboxMessages.slice(0,100) });
});

// 9. Message Logs & Error Stream
app.get('/api/logs', (req: Request, res: Response) => {
  const { status, type, limit = 50 } = req.query;
  let results = [...messageLogs];

  if (status) {
    results = results.filter(l => l.status === status);
  }
  if (type) {
    results = results.filter(l => l.type === type);
  }

  res.json({
    success: true,
    total: results.length,
    logs: results.slice(0, Math.min(500,Math.max(1,Number(limit)||50)))
  });
});

// Only authenticated administrators can reach these routes (integration keys cannot).
app.post('/api/recipients/check', async(req,res)=>{
  try { res.json({success:true,...await baileysManager.checkRecipient(String(req.body.recipient || ''))}); }
  catch(e){res.status(503).json({success:false,error:String(e)});}
});
app.delete('/api/logs', (req,res)=>{
  const ids=req.body?.ids;
  if(!Array.isArray(ids) || ids.length<1 || ids.length>500 || ids.some(id=>typeof id!=='string' || !id))
    return res.status(400).json({success:false,error:'Pilih 1–500 ID log yang akan dihapus.'});
  const selected=new Set(ids);
  const matches=messageLogs.filter(row=>selected.has(row.id));
  if(matches.some(row=>row.status==='queued'||row.status==='sending'))
    return res.status(409).json({success:false,error:'Log antrean atau pengiriman aktif tidak dapat dihapus.'});
  const before=[...messageLogs];
  for(let i=messageLogs.length-1;i>=0;i--) if(selected.has(messageLogs[i].id)) messageLogs.splice(i,1);
  try {persist();} catch(e) {messageLogs.splice(0,messageLogs.length,...before); throw e;}
  res.json({success:true,deleted:matches.length});
});

app.post('/api/logs/retry',async(req,res)=>{
  const log=messageLogs.find(l=>l.id===req.body.id);
  if(!log) return res.status(404).json({success:false,error:'Log tidak ditemukan.'});
  if(log.status!=='failed') return res.status(409).json({success:false,error:'Hanya pesan gagal yang dapat dicoba ulang.'});
  try {const result=await sendReal(log.recipient,log.content,log.type);log.retryCount++;persist();res.json({...result,log});}
  catch(e){res.status(503).json({success:false,error:String(e)});}
});

// 10. Real Analytics (Zero dummy default)
app.get('/api/analytics', (_req: Request, res: Response) => {
  const today = new Date().toLocaleDateString('en-CA',{timeZone:process.env.TZ || 'Asia/Makassar'});
  const dayLogs=messageLogs.filter(l=>new Date(l.timestamp).toLocaleDateString('en-CA',{timeZone:process.env.TZ || 'Asia/Makassar'})===today);
  const dayInbox=inboxMessages.filter(l=>new Date(l.timestamp).toLocaleDateString('en-CA',{timeZone:process.env.TZ || 'Asia/Makassar'})===today);
  const total = dayLogs.length;
  const delivered = dayLogs.filter(l => l.status === 'delivered' || l.status === 'read').length;
  const failed = dayLogs.filter(l => l.status === 'failed').length;
  const inbound = dayInbox.length;

  const otpCount = dayLogs.filter(l => l.type === 'otp').length;
  const transCount = dayLogs.filter(l => l.type === 'text').length;
  const promoCount = dayLogs.filter(l => l.type === 'broadcast').length;
  const botCount = dayLogs.filter(l => l.type === 'auto_reply').length;

  const successRate = total > 0 ? Number(((delivered / total) * 100).toFixed(1)) : 100.0;
  const avgLatency = total > 0 ? Math.round(dayLogs.reduce((acc, l) => acc + (l.latencyMs || 250), 0) / total) : 250;

  const hourlyData = Array.from({length:6},(_,i)=>{
    const hour=i*4;
    const bucket=(t:string)=>Math.floor(Number(new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:process.env.TZ || 'Asia/Makassar'}))/4)===i;
    const logs=dayLogs.filter(l=>bucket(l.timestamp));
    return {hour:String(hour).padStart(2,'0')+':00',sent:logs.filter(l=>['sent','delivered','read'].includes(l.status)).length,delivered:logs.filter(l=>['delivered','read'].includes(l.status)).length,failed:logs.filter(l=>l.status==='failed').length,inbound:dayInbox.filter(l=>bucket(l.timestamp)).length};
  });

  res.json({
    success: true,
    totalSentToday: total,
    totalDeliveredToday: delivered,
    totalFailedToday: failed,
    totalInboundToday: inbound,
    successRate,
    avgLatencyMs: avgLatency,
    breakdown: {
      otp: otpCount,
      transactional: transCount,
      promotional: promoCount,
      chatbot: botCount,
    },
    hourlyData
  });
});

// 11. Webhook Settings
app.get('/api/webhook/config', (_req: Request, res: Response) => {
  res.json({ success: true, webhook: webhookConfig });
});

app.post('/api/webhook/config',(req,res)=>{
  const {url,secretKey,isEnabled,events}=req.body;
  try {
    if(typeof url!=='string'||typeof secretKey!=='string'||typeof isEnabled!=='boolean') throw new Error('Konfigurasi tidak valid.');
    if(url) {const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Gunakan URL HTTPS publik.');}
    if(isEnabled && (!url || secretKey.length<16))throw new Error('Webhook aktif memerlukan URL dan secret minimal 16 karakter.');
    const nextEvents={...webhookConfig.events};
    for(const k of Object.keys(nextEvents) as (keyof typeof nextEvents)[]) {if(typeof events?.[k]!=='boolean')throw new Error('Event harus boolean.');nextEvents[k]=events[k];}
    webhookConfig={...webhookConfig,url,secretKey,isEnabled,events:nextEvents};persist();res.json({success:true,webhook:webhookConfig});
  }catch(e){res.status(400).json({success:false,error:String(e)});}
});
app.post('/api/webhook/test',async(req,res)=>{
  const result=await dispatch('webhook.test',{text:'Uji koneksi REEV WA Gateway'},true);
  res.status(result.success?200:502).json(result);
});

// 12. Full Project ZIP Export Route
app.get('/api/export/project-zip', async (_req: Request, res: Response) => {
  try {
    const zipBuffer = await createProjectZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="reev-wa-gateway-production.zip"');
    res.send(zipBuffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate zip';
    res.status(500).json({ success: false, error: msg });
  }
});

// 13. Single file exports
app.get('/api/export/:type', (req: Request, res: Response) => {
  const { type } = req.params;

  const exports: Record<string,string>={gas:'sdk/REEV_GAS.gs',node:'sdk/reev-client.mjs',docker:'docker-compose.yml'};
  if(exports[type]) return res.download(path.resolve(__dirname,exports[type]));

  res.status(404).json({ error: 'Unknown export type' });
});

// ==========================================
// VITE SPA INTEGRATION & STATIC SERVING
// ==========================================

app.use('/api', (_req, res) => res.status(404).json({ success: false, error: 'Endpoint tidak ditemukan' }));
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('Request failed:', err.message);
  res.status(err.status || 500).json({ success: false, error: 'Operasi gagal. Periksa log backend dan izin penyimpanan.' });
});

async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (fs.existsSync(path.resolve(process.env.DATA_DIR || 'sessions', 'default/creds.json'))) {
    void baileysManager.initSocket().catch(err => console.error('Gagal memulihkan sesi WA:', err.message));
  }
  app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
    console.log(`🚀 REEV WA Gateway listening on http://0.0.0.0:${PORT}`);
  });
}

// Only launch listening server in non-serverless environments (VPS, local, Docker)
if (process.env.VERCEL) throw new Error('Jalankan server.ts pada backend permanen; Vercel hanya menjalankan api/index.ts.');
if (process.env.NODE_ENV !== 'test') {
  setupServer().catch(err => {
    console.error('Failed to start REEV WA Gateway server:', err);
  });
}

export default app;
