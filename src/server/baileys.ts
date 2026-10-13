import 'dotenv/config';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  generateMessageIDV2,
  normalizeMessageContent,
  jidNormalizedUser,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { explainFailure } from './message-status.js';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.resolve(process.env.DATA_DIR || 'sessions');

export interface BaileysDeviceState {
  id: string;
  name: string;
  phone: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_ready' | 'auth_failure';
  batteryLevel: number;
  qrCode?: string;
  lastError?: string;
  pairingCode?: string;
  lastConnected?: string;
  uptimeSeconds: number;
  platform: string;
  isDefault: boolean;
}

export type IncomingMessageHandler = (msg: {
  messageId: string;
  timestamp: string;
  allowAutoReply: boolean;
  senderNumber: string;
  senderName: string;
  messageText: string;
  remoteJid: string;
}) => Promise<string | null>;

export class BaileysManager {
  private socket: WASocket | null = null;
  private qrRaw: string | null = null;
  private qrDataUrl: string | null = null;
  private pairingCode: string | null = null;
  private status: 'connected' | 'connecting' | 'disconnected' | 'qr_ready' | 'auth_failure' = 'disconnected';
  private connectedPhone: string = '';
  private connectedName: string = 'REEV WhatsApp Gateway';
  private startTime: number = Date.now();
  private incomingMessageHandler: IncomingMessageHandler | null = null;
  private isConnecting: boolean = false;
  private generation = 0;
  private credentialWrites: Promise<void> = Promise.resolve();
  private invalidSession = false;
  private get invalidSessionFile() {
    return path.join(this.dependencies.sessionsDir, 'default.invalid');
  }
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectionTimer?: ReturnType<typeof setTimeout>;
  private retryCount = 0;
  private lastError?: string;
  private receiptHandler?: (id:string,status:'delivered'|'read')=>void;
  private outgoingMessageLookup?: (id: string) => string | undefined;
  public setOutgoingMessageLookup(fn: (id: string) => string | undefined) { this.outgoingMessageLookup = fn; }
  private failureHandler?: (id: string, code: string, message: string) => void;
  public setFailureHandler(fn: (id: string, code: string, message: string) => void) { this.failureHandler = fn; }
  private statusHandler?: (status:string)=>void;
  public setReceiptHandler(fn:(id:string,status:'delivered'|'read')=>void) {this.receiptHandler=fn;}
  public setStatusHandler(fn:(status:string)=>void) {this.statusHandler=fn;}

  private clearTimers() {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.connectionTimer);
  }
  private stopSocket(closeTransport = true) {
    this.generation++;
    this.clearTimers();
    this.socket?.ev.removeAllListeners('connection.update');
    this.socket?.ev.removeAllListeners('messages.upsert');
    this.socket?.ev.removeAllListeners('creds.update');
    this.socket?.ev.removeAllListeners('messages.update');
    this.socket?.ev.removeAllListeners('message-receipt.update');
    if (closeTransport) this.socket?.end(new Error('Local connection stopped'));
    this.socket = null;
    this.isConnecting = false;
    this.qrDataUrl = null;
    this.qrRaw = null;
    this.pairingCode = null;
  }
  public async reconnect() {
    this.stopSocket();
    this.status = 'disconnected';
    this.retryCount = 0;
    return this.initSocket();
  }

  constructor(private dependencies = { makeSocket: makeWASocket, loadAuth: useMultiFileAuthState, sessionsDir: SESSIONS_DIR }) {
    fs.mkdirSync(this.dependencies.sessionsDir, { recursive: true, mode: 0o700 });
  }

  public setIncomingMessageHandler(handler: IncomingMessageHandler) {
    this.incomingMessageHandler = handler;
  }

  public async initSocket() {
    if (this.isConnecting || this.status === 'connected') {
      return;
    }
    this.clearTimers();
    const generation = ++this.generation;
    this.isConnecting = true;
    this.status = 'connecting';
    this.lastError = undefined;
    this.connectionTimer = setTimeout(() => {
      if (generation !== this.generation || this.status !== 'connecting') return;
      this.stopSocket();
      this.status = 'disconnected';
      this.lastError = 'Koneksi WhatsApp timeout. Periksa internet backend lalu klik Sambungkan Ulang.';
    }, 60000);

    try {
      const sessionPath = path.join(this.dependencies.sessionsDir, 'default');
      // Drain the old socket's credential writes before removing or reloading auth.
      await this.credentialWrites;
      if (generation !== this.generation) return;
      if (this.invalidSession || fs.existsSync(this.invalidSessionFile)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        fs.rmSync(this.invalidSessionFile, { force: true });
        this.invalidSession = false;
        this.connectedPhone = '';
        this.connectedName = 'REEV WhatsApp Gateway';
      }
      const { state, saveCreds } = await this.dependencies.loadAuth(sessionPath);

      const logger = pino({ level: 'silent' });

      if (generation !== this.generation) return;
      this.socket = this.dependencies.makeSocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        getMessage: async key => {
          const text = key.id && key.fromMe !== false ? this.outgoingMessageLookup?.(key.id) : undefined;
          return text ? { conversation: text } : undefined;
        },
        markOnlineOnConnect: true,
      });

      this.socket.ev.on('creds.update', () => {
        if (generation !== this.generation) return;
        this.credentialWrites = this.credentialWrites.then(async () => {
          await saveCreds();
        }).catch(err => {
          if (generation === this.generation) this.lastError = 'Gagal menyimpan sesi WhatsApp. Periksa izin DATA_DIR.';
          console.error(err);
        });
      });

      this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        if (generation !== this.generation) return;
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrRaw = qr;
          try {
            const dataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 300,
              color: { dark: '#020618', light: '#ffffff' }
            });
            if (generation !== this.generation) return;
            this.qrDataUrl = dataUrl;
            clearTimeout(this.connectionTimer);
            this.status = 'qr_ready';
          } catch (qrErr) {
            console.error('Error generating QR DataURL:', qrErr);
          }
        }

        if (connection === 'close') {
          this.stopSocket();
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
            this.status = 'auth_failure';
            this.connectedPhone = '';
            this.invalidSession = true;
            this.lastError = 'Sesi WhatsApp telah berakhir. Klik Minta QR Baru (Baileys) untuk membuat QR baru, lalu tautkan dari WhatsApp.';
            // Keep this marker across backend restarts. Only this device's auth is reset.
            try { fs.writeFileSync(this.invalidSessionFile, 'invalid', { mode: 0o600 }); }
            catch { this.lastError += ' Penanda sesi gagal disimpan; periksa izin DATA_DIR.'; }
          } else if (this.retryCount < 5) {
            const delay = Math.min(3000 * 2 ** this.retryCount++, 30000);
            this.status = 'connecting';
            this.lastError = 'Koneksi terputus; mencoba menyambungkan ulang.';
            this.reconnectTimer = setTimeout(() => { void this.initSocket().catch(() => {}); }, delay);
          } else {
            this.status = 'disconnected';
            this.lastError = 'Koneksi gagal setelah 5 percobaan. Periksa internet backend lalu sambungkan ulang.';
          }
        } else if (connection === 'open') {
          clearTimeout(this.connectionTimer);
          this.retryCount = 0;
          this.lastError = undefined;
          this.isConnecting = false;
          this.status = 'connected';
          this.qrDataUrl = null;
          this.qrRaw = null;
          this.startTime = Date.now();

          const userJid = this.socket?.user?.id || '';
          this.connectedPhone = userJid.split('@')[0].split(':')[0];
          this.connectedName = this.socket?.user?.name || 'REEV Production Bot';
          console.log(`✅ Baileys Connected successfully! Phone: ${this.connectedPhone}`);
        }
        this.statusHandler?.(this.status);
      });

      this.socket.ev.on('messages.update', updates => {
        if (generation !== this.generation) return;
        for (const { key, update } of updates) {
          if (key.fromMe === false || !key.id) continue;
          if (update.status === 0) {
            const code = String(update.messageStubParameters?.[0] || 'WA_REJECTED').slice(0, 80);
            this.failureHandler?.(key.id, code, explainFailure(code));
          }
          if (update.status === 3) this.receiptHandler?.(key.id, 'delivered');
          if (update.status === 4 || update.status === 5) this.receiptHandler?.(key.id, 'read');
        }
      });
      this.socket.ev.on('message-receipt.update', updates => {
        if (generation !== this.generation) return;
        for (const { key, receipt } of updates) {
          if (key.fromMe === false || !key.id) continue;
          if (receipt.readTimestamp || receipt.playedTimestamp) this.receiptHandler?.(key.id, 'read');
          else if (receipt.receiptTimestamp) this.receiptHandler?.(key.id, 'delivered');
        }
      });
      this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (generation !== this.generation) return;
        const socket = this.socket;
        for (const msg of messages || []) {
          if (generation !== this.generation) return;
          if (!msg.message || msg.key.fromMe || !msg.key.id) continue;
          const remoteJid = msg.key.remoteJid || '';
          // Personal chats support both phone-number JIDs and privacy LIDs.
          if (!remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.endsWith('@lid')) continue;
          try {
            let phoneJid = remoteJid.endsWith('@s.whatsapp.net') ? remoteJid : msg.key.remoteJidAlt;
            if (!phoneJid?.endsWith('@s.whatsapp.net')) {
              try { phoneJid = await socket?.signalRepository?.lidMapping?.getPNForLID(remoteJid) || undefined; }
              catch { phoneJid = undefined; } // Keep the original LID if a mapping is unavailable.
            }
            if (generation !== this.generation) return;
            const senderNumber = phoneJid?.endsWith('@s.whatsapp.net') ? jidNormalizedUser(phoneJid).split('@')[0] : '';
            const content = normalizeMessageContent(msg.message);
            if (!content) continue;
            const text = content.conversation || content.extendedTextMessage?.text ||
              content.imageMessage?.caption || content.videoMessage?.caption ||
              content.documentMessage?.caption || content.buttonsResponseMessage?.selectedDisplayText ||
              content.listResponseMessage?.singleSelectReply?.selectedRowId || '';
            const mediaLabel = content.imageMessage ? '[Gambar]' : content.videoMessage ? '[Video]' :
              content.audioMessage ? '[Audio]' : content.documentMessage ? '[Dokumen]' :
              content.stickerMessage ? '[Stiker]' : content.contactMessage || content.contactsArrayMessage ? '[Kontak]' :
              content.locationMessage || content.liveLocationMessage ? '[Lokasi]' : '';
            const messageText = text.trim() ? text : mediaLabel;
            if (!messageText) continue; // Ignore protocol, reaction and other control messages.
            const seconds = Number(msg.messageTimestamp);
            const timestamp = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
            const replyText = await this.incomingMessageHandler?.({
              messageId: msg.key.id, timestamp, allowAutoReply: type === 'notify' && !!text.trim(),
              senderNumber, senderName: msg.pushName || 'Pengirim WhatsApp', messageText, remoteJid,
            });
            if (replyText && generation === this.generation) await socket?.sendMessage(remoteJid, { text: replyText });
          } catch (err) {
            console.error('Gagal memproses pesan masuk:', err instanceof Error ? err.message : 'unknown error');
          }
        }
      });
    } catch (err) {
      if (generation !== this.generation) return;
      this.stopSocket();
      this.status = 'disconnected';
      this.lastError = err instanceof Error ? err.message : 'Inisialisasi Baileys gagal';
      throw err;
    }
  }

  public async requestPairingCode(phone: string): Promise<string> {
    if (!this.socket) {
      await this.initSocket();
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) throw new Error('Nomor telepon tidak valid');

    try {
      const deadline = Date.now() + 15000;
      while (this.status === 'connecting' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 200));
      if (!this.socket || this.status !== 'qr_ready') throw new Error('Koneksi belum siap untuk pairing code. Tunggu QR muncul lalu coba lagi.');
      const code = await this.socket.requestPairingCode(cleanPhone);
      if (!code) throw new Error('WhatsApp belum mengembalikan pairing code.');
      this.pairingCode = code || null;
      return code || '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat pairing code';
      throw new Error(msg);
    }
  }

  public async checkRecipient(recipient: string): Promise<{ exists: boolean; jid: string }> {
    let phone = recipient.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    if (!/^[1-9][0-9]{7,14}$/.test(phone)) throw new Error('Nomor tidak valid. Gunakan kode negara, contoh 628...');
    const socket = this.socket;
    const generation = this.generation;
    if (!socket || this.status !== 'connected') throw new Error('Sesi WhatsApp belum terhubung.');
    const results = await socket.onWhatsApp(phone);
    if (generation !== this.generation || this.status !== 'connected') throw new Error('Koneksi berubah saat memeriksa nomor. Coba setelah terhubung.');
    if (!Array.isArray(results)) throw new Error('Pemeriksaan nomor belum mendapat jawaban WhatsApp. Coba lagi nanti.');
    const found = results.find(row => row.exists);
    return { exists: !!found, jid: found?.jid || `${phone}@s.whatsapp.net` };
  }

  public async sendTextMessage(recipient: string, message: string, onMessageId?: (id: string) => void, remoteJid?: string): Promise<{ messageId: string; latencyMs: number }> {
    const cleanPhone = recipient.replace(/[^0-9]/g, '');
    let jid = remoteJid ? jidNormalizedUser(remoteJid) : `${cleanPhone}@s.whatsapp.net`;
    if (!/^[0-9]+@(s\.whatsapp\.net|lid)$/.test(jid)) throw new Error('Identitas tujuan tidak valid');
    const start = Date.now();

    if (this.socket && this.status === 'connected') {
      if (!remoteJid) {
        const target = await this.checkRecipient(recipient);
        if (!target.exists) throw new Error('Nomor tujuan tidak terdaftar WhatsApp menurut hasil pemeriksaan saat ini.');
        jid = jidNormalizedUser(target.jid);
      }
      const messageId = generateMessageIDV2(this.socket!.user?.id);
      // Persist the provider ID before sendMessage can emit a receipt.
      onMessageId?.(messageId);
      const result = await this.socket!.sendMessage(jid, { text: message }, { messageId });
      if(!result?.key?.id) throw new Error('WhatsApp tidak mengembalikan ID pesan; hasil belum pasti.');
      const latencyMs = Date.now() - start;
      return {
        messageId: result?.key?.id || '',
        latencyMs,
      };
    } else {
      // If socket is not yet paired, throw informative error
      throw new Error('Sesi WhatsApp Baileys belum terhubung. Silakan scan QR code di menu Perangkat terlebih dahulu.');
    }
  }

  public async disconnect() {
    const socket = this.socket;
    this.stopSocket(false);
    try { await socket?.logout(); } catch {}
    finally { socket?.end(new Error('Local session reset')); }
    await this.credentialWrites;
    fs.rmSync(path.join(this.dependencies.sessionsDir, 'default'), { recursive: true, force: true });
    fs.rmSync(this.invalidSessionFile, { force: true });
    this.invalidSession = false;
    this.status = 'disconnected';
    this.connectedPhone = '';
    this.retryCount = 0;
    this.lastError = undefined;
  }

  public getDeviceState(): BaileysDeviceState {
    const uptime = this.status === 'connected' ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    return {
      id: 'device_primary',
      name: this.connectedName || 'REEV Production Bot',
      phone: this.connectedPhone ? `+${this.connectedPhone}` : '',
      status: this.status,
      batteryLevel: -1,
      qrCode: this.qrDataUrl || undefined,
      lastError: this.lastError,
      pairingCode: this.pairingCode || undefined,
      lastConnected: this.status === 'connected' ? new Date(this.startTime).toISOString() : undefined,
      uptimeSeconds: uptime,
      platform: 'WhatsApp Multi-Device / Baileys',
      isDefault: true,
    };
  }

  public getRawQr(): string | null {
    return this.qrRaw;
  }
}

export const baileysManager = new BaileysManager();
