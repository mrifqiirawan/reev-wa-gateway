import React from 'react';
import { Menu, Send, ShieldCheck, Wifi, Download } from 'lucide-react';
import { NavView } from './Sidebar';

interface HeaderProps {
  currentView: NavView;
  onOpenMobileMenu: () => void;
  onOpenQuickSend: () => void;
  connectedCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenMobileMenu,
  onOpenQuickSend,
  connectedCount,
}) => {
  const viewTitles: Record<NavView, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard Analitik',
      subtitle: 'Monitoring performa pengiriman pesan, throughput & latensi real-time',
    },
    devices: {
      title: 'Manajemen Perangkat',
      subtitle: 'Sesi WhatsApp Baileys persisten, scan QR code & pairing code',
    },
    autoresponder: {
      title: 'Auto-Responder & Chatbot',
      subtitle: 'Penerima pesan otomatis dengan variabel dinamis & simulator live',
    },
    broadcast: {
      title: 'Pesan Massal (Bulk Campaign)',
      subtitle: 'Kirim broadcast promosi ke ribuan kontak dengan jeda anti-blokir',
    },
    inbox: {
      title: 'Pesan Masuk (Inbox Stream)',
      subtitle: 'Feed pesan real-time dari pelanggan beserta balasan otomatis bot',
    },
    logs: {
      title: 'Log Error & Pengiriman',
      subtitle: 'Audit trail pengiriman, monitoring kegagalan dan fitur retry instan',
    },
    api: {
      title: 'API & Webhook Console',
      subtitle: 'Uji coba endpoint REST API, manajemen token dan event dispatching',
    },
    docs: {
      title: 'Panduan & SDK Integrasi',
      subtitle: 'Contoh kode siap pakai untuk GAS, Flutter, Node.js, cURL dan VPS',
    },
    settings: {
      title: 'Pengaturan & Keamanan Akun',
      subtitle: 'Ganti username, password login admin, dan konfigurasi proteksi server',
    },
  };

  const currentInfo = viewTitles[currentView] || {
    title: 'REEV WA Gateway',
    subtitle: 'Enterprise WhatsApp Messaging Engine',
  };

  return (
    <header className="sticky top-0 z-30 h-18 bg-[#020618]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 flex items-center justify-between gap-4">
      {/* Zone 1: Mobile toggle & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 text-slate-400 hover:text-white rounded-lg border border-slate-800 lg:hidden"
          aria-label="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base lg:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            {currentInfo.title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block truncate max-w-md">
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Zone 2: Device Status Pill (Clean unboxed text or subtle status) */}
      <div className="hidden md:flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
          <Wifi className={`w-3.5 h-3.5 ${connectedCount > 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
          <span className="text-slate-400">Status Server:</span>
          <span className={`font-medium font-mono ${connectedCount > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {connectedCount > 0 ? `${connectedCount} Device Terhubung` : 'Offline (Perlu Scan)'}
          </span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-slate-400">Anti-Ban:</span>
          <span className="font-mono text-sky-300">Aktif (Adaptive Jitter)</span>
        </div>
      </div>

      {/* Zone 3: Primary Action Buttons */}
      <div className="flex items-center gap-2.5">
        <a
          href="/api/export/project-zip"
          download="reev-wa-gateway-production.zip"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 active:scale-98 rounded-lg transition-all whitespace-nowrap shrink-0"
          title="Download Full Project ZIP (siap upload GitHub atau VPS)"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Download ZIP Proyek</span>
          <span className="sm:hidden">ZIP</span>
        </a>

        <button
          onClick={onOpenQuickSend}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 active:scale-98 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all whitespace-nowrap shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Kirim Pesan</span>
        </button>
      </div>
    </header>
  );
};
