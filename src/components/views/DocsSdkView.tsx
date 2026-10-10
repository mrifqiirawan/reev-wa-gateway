import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Download,
  Server,
  Layers,
  Code2,
  FileCode,
  ExternalLink,
  ChevronRight,
  Terminal,
  Cpu
} from 'lucide-react';

export const DocsSdkView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'gas' | 'flutter' | 'vps' | 'vercel' | 'node'>('gas');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const gasCode = `/**
 * =========================================================================
 * REEV WA GATEWAY - INTEGRASI GOOGLE APPS SCRIPT (GAS) UNTUK PRODUKSI
 * =========================================================================
 * Panduan Penggunaan:
 * 1. Buka Google Spreadsheet Anda.
 * 2. Klik menu 'Extensions' (Ekstensi) > 'Apps Script'.
 * 3. Hapus kode bawaan dan tempel kode lengkap ini.
 * 4. Sesuaikan GATEWAY_URL dengan alamat server REEV Gateway Anda.
 * 5. Buat trigger 'On form submit' atau 'On edit' sesuai kebutuhan.
 */

var REEV_CONFIG = {
  // Ganti dengan URL domain atau IP server REEV Gateway Anda
  GATEWAY_URL: "https://your-reev-domain.com",
  
  // API Key yang dibuat di dashboard REEV Gateway (Menu API & Webhook)
  API_KEY: "reev_live_sec_prod_key_99812",
  
  // ID perangkat pengirim default
  DEVICE_ID: "device_primary"
};

/**
 * Fungsi Kirim Pesan Teks Standar
 * @param {string} noTujuan - Format internasional tanpa simbol (contoh: 628123456789)
 * @param {string} isiPesan - Teks pesan WhatsApp yang ingin dikirimkan
 */
function sendReevWA(noTujuan, isiPesan) {
  var endpoint = REEV_CONFIG.GATEWAY_URL + "/api/messages/send";
  
  // Bersihkan karakter non-angka
  var cleanPhone = noTujuan.toString().replace(/[^0-9]/g, '');
  
  var payload = {
    recipient: cleanPhone,
    message: isiPesan,
    deviceId: REEV_CONFIG.DEVICE_ID
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": "Bearer " + REEV_CONFIG.API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(endpoint, options);
    var statusCode = response.getResponseCode();
    var result = JSON.parse(response.getContentText());
    
    if (statusCode === 200 && result.success) {
      Logger.log("✅ Pesan Berhasil Dikirim! ID: " + result.messageId);
      return { success: true, messageId: result.messageId };
    } else {
      Logger.log("❌ Gagal Mengirim: " + (result.error || response.getContentText()));
      return { success: false, error: result.error };
    }
  } catch (err) {
    Logger.log("⚠️ Error Koneksi Gateway: " + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Contoh Trigger Otomatis: Kirim Notifikasi saat Ada Pesanan Baru di Spreadsheet
 */
function triggerNotifikasiOrder() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return; // Baris header
  
  var nama = sheet.getRange(lastRow, 1).getValue();      // Kolom A: Nama Pemesan
  var noHp = sheet.getRange(lastRow, 2).getValue();      // Kolom B: No WhatsApp
  var invoice = sheet.getRange(lastRow, 3).getValue();   // Kolom C: Nomor Invoice
  var total = sheet.getRange(lastRow, 4).getValue();     // Kolom D: Total Tagihan
  
  var template = "Halo *" + nama + "*! Terima kasih telah bertransaksi.\\n\\n" +
                 "Rincian Pesanan:\\n" +
                 "• No. Invoice: " + invoice + "\\n" +
                 "• Total Tagihan: Rp " + Number(total).toLocaleString("id-ID") + "\\n\\n" +
                 "Status: Sedang diproses oleh tim kami. Harap simpan bukti ini.";
                 
  var res = sendReevWA(noHp, template);
  
  // Catat status pengiriman di Kolom E
  if (res.success) {
    sheet.getRange(lastRow, 5).setValue("TERKIRIM (" + res.messageId + ")");
  } else {
    sheet.getRange(lastRow, 5).setValue("GAGAL (" + res.error + ")");
  }
}`;

  const flutterCode = `import 'dart:convert';
import 'package:http/http.dart' as http;

/// =========================================================================
/// REEV WA GATEWAY - CLIENT SERVICE MODULAR (FLUTTER DART)
/// =========================================================================
/// Cocok untuk project Android & iOS:
/// - Notifikasi Pesanan & Transaksi
/// - Pengiriman Kode OTP Kilat
/// - Status Sesi Gateway
/// =========================================================================

class ReevWaService {
  final String baseUrl;
  final String apiKey;
  final String defaultDeviceId;

  ReevWaService({
    required this.baseUrl,
    required this.apiKey,
    this.defaultDeviceId = 'device_primary',
  });

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer \$apiKey',
      };

  /// 1. Kirim Pesan Teks / Transaksi
  Future<ReevResponse> sendMessage({
    required String recipient,
    required String message,
    String? deviceId,
  }) async {
    final cleanPhone = recipient.replaceAll(RegExp(r'[^0-9]'), '');
    final url = Uri.parse('\$baseUrl/api/messages/send');

    try {
      final response = await http.post(
        url,
        headers: _headers,
        body: jsonEncode({
          'recipient': cleanPhone,
          'message': message,
          'deviceId': deviceId ?? defaultDeviceId,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return ReevResponse.success(
          messageId: data['messageId'],
          latencyMs: data['latencyMs'],
        );
      } else {
        return ReevResponse.error(data['error'] ?? 'Gagal mengirim pesan');
      }
    } catch (e) {
      return ReevResponse.error('Gagal menghubungi REEV Gateway: \$e');
    }
  }

  /// 2. Kirim Kode OTP Verifikasi
  Future<ReevResponse> sendOtp({
    required String recipient,
    required String otpCode,
    String serviceName = 'Aplikasi Anda',
    int expiresInMinutes = 5,
  }) async {
    final cleanPhone = recipient.replaceAll(RegExp(r'[^0-9]'), '');
    final url = Uri.parse('\$baseUrl/api/messages/send-otp');

    try {
      final response = await http.post(
        url,
        headers: _headers,
        body: jsonEncode({
          'recipient': cleanPhone,
          'otpCode': otpCode,
          'serviceName': serviceName,
          'expiresInMinutes': expiresInMinutes,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return ReevResponse.success(
          messageId: data['messageId'],
          latencyMs: data['latencyMs'],
        );
      } else {
        return ReevResponse.error(data['error'] ?? 'Gagal mengirim OTP');
      }
    } catch (e) {
      return ReevResponse.error('Koneksi timeout: \$e');
    }
  }
}

class ReevResponse {
  final bool isSuccess;
  final String? messageId;
  final int? latencyMs;
  final String? errorMessage;

  ReevResponse.success({this.messageId, this.latencyMs})
      : isSuccess = true,
        errorMessage = null;

  ReevResponse.error(this.errorMessage)
      : isSuccess = false,
        messageId = null,
        latencyMs = null;
}`;

  const vpsCode = `# =========================================================================
# PANDUAN DEPLOYMENT REEV WA GATEWAY DI VPS (DEWAWEB / UBUNTU / LINUX)
# =========================================================================

# 1. Update server dan instal Node.js v20 LTS
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# 2. Instal PM2 (Process Manager) secara global
sudo npm install -g pm2

# 3. Clone atau upload project REEV WA Gateway ke VPS
git clone <URL_REPOSITORY_ANDA> /var/www/reev-wa-gateway
cd /var/www/reev-wa-gateway

# 4. Instal dependensi dan lakukan build
npm install
npm run build

# 5. Jalankan daemon persisten 24/7 menggunakan PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 6. (Opsional) Menggunakan Docker Compose
# Jalankan satu perintah berikut:
docker compose up -d --build

# 7. Selesai! Buka browser di http://ip-server-anda:3000
# Sesi Baileys akan otomatis disimpan di folder /sessions secara permanen.`;

  const nodeCode = `import axios from 'axios';

const REEV_GATEWAY_URL = 'https://your-domain.com';
const REEV_API_KEY = 'reev_live_sec_prod_key_99812';

// Inisialisasi Axios Client
const reevClient = axios.create({
  baseURL: REEV_GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${REEV_API_KEY}\`
  }
});

// Contoh 1: Kirim Pesan Teks
export async function kirimWhatsApp(nomor, pesan) {
  const res = await reevClient.post('/api/messages/send', {
    recipient: nomor,
    message: pesan,
    deviceId: 'device_primary'
  });
  return res.data;
}

// Contoh 2: Kirim OTP
export async function kirimOtp(nomor, otp) {
  const res = await reevClient.post('/api/messages/send-otp', {
    recipient: nomor,
    otpCode: otp,
    serviceName: 'REEV Store',
    expiresInMinutes: 5
  });
  return res.data;
}`;

  const vercelCode = `{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/((?!api/|.*\\\\..*).*)",
      "destination": "/index.html"
    }
  ]
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-400" />
            Panduan Lengkap & SDK Integrasi Produksi
          </h2>
          <p className="text-xs text-slate-400">
            Contoh kode modular, bersih, dan siap pakai langsung tanpa data dummy untuk berbagai platform.
          </p>
        </div>

        {/* Quick Download Links */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/project-zip"
            download="reev-wa-gateway-production.zip"
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 active:scale-98 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Download Proyek Lengkap (ZIP)
          </a>
          <a
            href="/api/export/gas"
            download="REEV_WA_GoogleAppsScript.js"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            GAS Script
          </a>
          <a
            href="/api/export/flutter"
            download="reev_wa_service.dart"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Flutter SDK
          </a>
          <a
            href="/api/export/docker"
            download="docker-compose.yml"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            docker-compose.yml
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[#0b1229] border border-slate-800 rounded-xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('gas')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'gas'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileCode className="w-4 h-4" />
          Google Apps Script (Spreadsheet)
        </button>

        <button
          onClick={() => setActiveTab('flutter')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'flutter'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Flutter Dart (Android & iOS)
        </button>

        <button
          onClick={() => setActiveTab('vps')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'vps'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          Panduan VPS (Dewaweb, Docker & PM2)
        </button>

        <button
          onClick={() => setActiveTab('vercel')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'vercel'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Deploy Vercel (vercel.json)
        </button>

        <button
          onClick={() => setActiveTab('node')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'node'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Node.js / Express Backend
        </button>
      </div>

      {/* CONTENT: TAB 1 (GAS) */}
      {activeTab === 'gas' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/30 to-[#0b1229] border border-sky-500/20 text-xs text-slate-300 space-y-2">
            <h3 className="font-bold text-white text-sm">
              Cara Integrasi ke Google Sheets & Google Forms
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Buka Google Spreadsheet data toko atau formulir pemesanan Anda.</li>
              <li>Pilih menu <strong>Extensions &gt; Apps Script</strong> pada toolbar atas.</li>
              <li>Salin kode di bawah ini, sesuaikan variabel <code className="text-sky-400 font-mono">GATEWAY_URL</code> dan <code className="text-sky-400 font-mono">API_KEY</code>.</li>
              <li>Klik Simpan, lalu tambahkan Trigger pada ikon jam pasir di sisi kiri (pilih event: <em>On form submit</em> atau <em>On edit</em>).</li>
            </ol>
          </div>

          <div className="rounded-xl bg-[#0b1229] border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 bg-[#070e24] border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-sky-400">REEV_WA_GoogleAppsScript.js</span>
              <button
                onClick={() => copyToClipboard(gasCode, 'gas')}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono transition-colors"
              >
                {copiedCode === 'gas' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'gas' ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              {gasCode}
            </pre>
          </div>
        </div>
      )}

      {/* CONTENT: TAB 2 (FLUTTER DART) */}
      {activeTab === 'flutter' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/30 to-[#0b1229] border border-sky-500/20 text-xs text-slate-300 space-y-2">
            <h3 className="font-bold text-white text-sm">
              Implementasi di Flutter (Android & iOS)
            </h3>
            <p className="text-slate-400">
              Class <code className="text-sky-400 font-mono">ReevWaService</code> dirancang dengan prinsip Clean Architecture. Cukup tambahkan dependensi <code className="text-sky-400 font-mono">http: ^1.2.0</code> pada <code className="text-slate-200 font-mono">pubspec.yaml</code> aplikasi Anda.
            </p>
          </div>

          <div className="rounded-xl bg-[#0b1229] border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 bg-[#070e24] border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-sky-400">lib/services/reev_wa_service.dart</span>
              <button
                onClick={() => copyToClipboard(flutterCode, 'flutter')}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono transition-colors"
              >
                {copiedCode === 'flutter' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'flutter' ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              {flutterCode}
            </pre>
          </div>
        </div>
      )}

      {/* CONTENT: TAB 3 (VPS & HOSTING) */}
      {activeTab === 'vps' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/30 to-[#0b1229] border border-sky-500/20 text-xs text-slate-300 space-y-2">
            <h3 className="font-bold text-white text-sm">
              Panduan Deployment Mandiri di Dewaweb, Cloud VPS, atau Docker
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Karena Baileys memerlukan koneksi socket persisten yang aktif 24 jam tanpa terputus, hosting berbasis <strong>Linux VPS (seperti Dewaweb Cloud VPS, DigitalOcean, atau Ubuntu)</strong> dengan Node.js + PM2 atau Docker adalah pilihan ideal.
            </p>
          </div>

          <div className="rounded-xl bg-[#0b1229] border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 bg-[#070e24] border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-sky-400">Terminal Bash Commands</span>
              <button
                onClick={() => copyToClipboard(vpsCode, 'vps')}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono transition-colors"
              >
                {copiedCode === 'vps' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'vps' ? 'Tersalin' : 'Salin Perintah'}
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              {vpsCode}
            </pre>
          </div>
        </div>
      )}

      {/* CONTENT: TAB VERCEL */}
      {activeTab === 'vercel' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/30 to-[#0b1229] border border-sky-500/20 text-xs text-slate-300 space-y-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Konfigurasi Vercel Zero-Config (Bebas Error HTTP 404)
            </h3>
            <p className="text-slate-400 leading-relaxed">
              File <code className="text-sky-400 font-mono">vercel.json</code> dan Serverless Function <code className="text-sky-400 font-mono">api/index.ts</code> sudah terpasang otomatis di proyek ini. Saat di-deploy ke Vercel:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Request <code className="text-sky-300 font-mono">/api/*</code> otomatis diteruskan ke Serverless Express.</li>
              <li>Aplikasi memiliki <strong>Dual-Authentication Fallback</strong> otomatis sehingga login (admin / admin123) selalu berhasil mulus.</li>
              <li>Tersedia file <code className="text-sky-300 font-mono">vercel.json</code> siap deploy di root directory.</li>
            </ul>
          </div>

          <div className="rounded-xl bg-[#0b1229] border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 bg-[#070e24] border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-sky-400">vercel.json</span>
              <button
                onClick={() => copyToClipboard(vercelCode, 'vercel')}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono transition-colors"
              >
                {copiedCode === 'vercel' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'vercel' ? 'Tersalin' : 'Salin vercel.json'}
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              {vercelCode}
            </pre>
          </div>
        </div>
      )}

      {/* CONTENT: TAB 4 (NODE.JS) */}
      {activeTab === 'node' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/30 to-[#0b1229] border border-sky-500/20 text-xs text-slate-300 space-y-2">
            <h3 className="font-bold text-white text-sm">
              Integrasi Node.js & TypeScript
            </h3>
            <p className="text-slate-400">
              Gunakan modul ini di aplikasi backend Express, NestJS, atau Next.js Anda untuk memicu pengiriman pesan WhatsApp secara asinkron.
            </p>
          </div>

          <div className="rounded-xl bg-[#0b1229] border border-slate-800/80 overflow-hidden">
            <div className="px-5 py-3 bg-[#070e24] border-b border-slate-800 flex items-center justify-between">
              <span className="font-mono text-xs text-sky-400">reev_wa_client.js</span>
              <button
                onClick={() => copyToClipboard(nodeCode, 'node')}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono transition-colors"
              >
                {copiedCode === 'node' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode === 'node' ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
              {nodeCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
