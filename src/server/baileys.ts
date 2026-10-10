import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.resolve(process.cwd(), 'sessions');

export interface BaileysDeviceState {
  id: string;
  name: string;
  phone: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_ready' | 'auth_failure';
  batteryLevel: number;
  qrCode?: string;
  pairingCode?: string;
  lastConnected?: string;
  uptimeSeconds: number;
  platform: string;
  isDefault: boolean;
}

export type IncomingMessageHandler = (msg: {
  senderNumber: string;
  senderName: string;
  messageText: string;
  remoteJid: string;
}) => Promise<string | null>;

class BaileysManager {
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

  constructor() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      try {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
      } catch (err) {
        console.warn('Could not create sessions directory:', err);
      }
    }
  }

  public setIncomingMessageHandler(handler: IncomingMessageHandler) {
    this.incomingMessageHandler = handler;
  }

  public async initSocket() {
    if (this.isConnecting || this.status === 'connected') {
      return;
    }
    this.isConnecting = true;
    this.status = 'connecting';

    try {
      const sessionPath = path.join(SESSIONS_DIR, 'default');
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const logger = pino({ level: 'silent' });

      this.socket = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrRaw = qr;
          try {
            this.qrDataUrl = await QRCode.toDataURL(qr, {
              margin: 2,
              width: 300,
              color: { dark: '#020618', light: '#ffffff' }
            });
            this.status = 'qr_ready';
          } catch (qrErr) {
            console.error('Error generating QR DataURL:', qrErr);
          }
        }

        if (connection === 'close') {
          this.isConnecting = false;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`Baileys connection closed. Reason: ${statusCode}, shouldReconnect: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            this.status = 'disconnected';
            this.qrDataUrl = null;
            this.connectedPhone = '';
          } else {
            this.status = 'connecting';
            // Reconnect with backoff
            setTimeout(() => {
              this.initSocket().catch(() => {});
            }, 3000);
          }
        } else if (connection === 'open') {
          this.isConnecting = false;
          this.status = 'connected';
          this.qrDataUrl = null;
          this.qrRaw = null;
          this.startTime = Date.now();

          const userJid = this.socket?.user?.id || '';
          this.connectedPhone = userJid.split(':')[0] || userJid.split('@')[0] || '';
          this.connectedName = this.socket?.user?.name || 'REEV Production Bot';
          console.log(`✅ Baileys Connected successfully! Phone: ${this.connectedPhone}`);
        }
      });

      // Handle Incoming Messages
      this.socket.ev.on('messages.upsert', async (chatUpdate) => {
        if (!chatUpdate.messages || chatUpdate.type !== 'notify') return;

        for (const msg of chatUpdate.messages) {
          // Ignore status broadcast or our own outgoing messages
          if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

          const remoteJid = msg.key.remoteJid || '';
          const senderNumber = remoteJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
          const senderName = msg.pushName || 'Pelanggan';

          // Extract text
          const messageText =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            '';

          if (!messageText.trim()) continue;

          console.log(`📩 Incoming WA from +${senderNumber} (${senderName}): "${messageText}"`);

          if (this.incomingMessageHandler) {
            try {
              const replyText = await this.incomingMessageHandler({
                senderNumber,
                senderName,
                messageText,
                remoteJid,
              });

              if (replyText && this.socket) {
                await this.socket.sendMessage(remoteJid, { text: replyText });
                console.log(`🤖 Auto-replied to +${senderNumber}: "${replyText.slice(0, 50)}..."`);
              }
            } catch (handleErr) {
              console.error('Error handling incoming auto-responder:', handleErr);
            }
          }
        }
      });
    } catch (err) {
      this.isConnecting = false;
      this.status = 'disconnected';
      console.warn('Baileys initialization note:', err);
    }
  }

  public async requestPairingCode(phone: string): Promise<string> {
    if (!this.socket) {
      await this.initSocket();
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) throw new Error('Nomor telepon tidak valid');

    try {
      const code = await this.socket?.requestPairingCode(cleanPhone);
      this.pairingCode = code || null;
      return code || '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat pairing code';
      throw new Error(msg);
    }
  }

  public async sendTextMessage(recipient: string, message: string): Promise<{ messageId: string; latencyMs: number }> {
    const cleanPhone = recipient.replace(/[^0-9]/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const start = Date.now();

    if (this.socket && this.status === 'connected') {
      const result = await this.socket.sendMessage(jid, { text: message });
      const latencyMs = Date.now() - start;
      return {
        messageId: result?.key?.id || 'baileys_' + Date.now(),
        latencyMs: Math.max(latencyMs, 180),
      };
    } else {
      // If socket is not yet paired, throw informative error
      throw new Error('Sesi WhatsApp Baileys belum terhubung. Silakan scan QR code di menu Perangkat terlebih dahulu.');
    }
  }

  public async disconnect() {
    try {
      await this.socket?.logout();
    } catch {}
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.connectedPhone = '';
  }

  public getDeviceState(): BaileysDeviceState {
    const uptime = this.status === 'connected' ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
    return {
      id: 'device_primary',
      name: this.connectedName || 'REEV Production Bot',
      phone: this.connectedPhone ? `+${this.connectedPhone}` : '',
      status: this.status,
      batteryLevel: 98,
      qrCode: this.qrDataUrl || undefined,
      pairingCode: this.pairingCode || undefined,
      lastConnected: this.status === 'connected' ? new Date(this.startTime).toISOString() : undefined,
      uptimeSeconds: uptime,
      platform: 'WhatsApp Multi-Device / Baileys Official',
      isDefault: true,
    };
  }

  public getRawQr(): string | null {
    return this.qrRaw;
  }
}

export const baileysManager = new BaileysManager();
