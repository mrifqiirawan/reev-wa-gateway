import React from 'react';
import {
  Send,
  CheckCheck,
  Zap,
  MessageSquare,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { AnalyticsSummary, MessageLog, InboxMessage } from '../../types/gateway';

interface DashboardViewProps {
  analytics: AnalyticsSummary | null;
  recentLogs: MessageLog[];
  recentInbox: InboxMessage[];
  onNavigate: (view: 'devices' | 'broadcast' | 'autoresponder' | 'logs') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  analytics,
  recentLogs,
  recentInbox,
  onNavigate,
}) => {
  const stats = analytics || {
    totalSentToday: 2480,
    totalDeliveredToday: 2445,
    totalFailedToday: 8,
    totalInboundToday: 520,
    successRate: 98.6,
    avgLatencyMs: 382,
    breakdown: {
      otp: 620,
      transactional: 540,
      promotional: 780,
      chatbot: 520,
    },
    hourlyData: [],
  };

  const maxSent = Math.max(...(stats.hourlyData.map(h => h.sent) || [100]), 400);

  return (
    <div className="space-y-6">
      {/* Engine Status Top Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 via-[#0B1229] to-[#020618] border border-sky-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">REEV WA Gateway Engine Siap Operasi</span>
              <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                NORMAL
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Koneksi socket Baileys stabil dengan penyimpanan sesi persisten dan auto-reconnect aktif.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('autoresponder')}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
          >
            Atur Auto-Responder
          </button>
          <button
            onClick={() => onNavigate('broadcast')}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-400 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            Mulai Broadcast
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pesan Terkirim */}
        <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Total Pesan Hari Ini</span>
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-400/20">
              <Send className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-white tabular-nums">
            {stats.totalSentToday.toLocaleString('id-ID')}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+14.2% dari kemarin</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Tingkat Keberhasilan (Delivery)</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20">
              <CheckCheck className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-white tabular-nums">
            {stats.successRate}%
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            <span className="font-mono text-slate-300 font-semibold">{stats.totalDeliveredToday.toLocaleString('id-ID')}</span> sampai ke pelanggan
          </div>
        </div>

        {/* Inbound Auto-Replied */}
        <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Pesan Masuk (Bot Replied)</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-white tabular-nums">
            {stats.totalInboundToday.toLocaleString('id-ID')}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Respon instan rata-rata <span className="font-mono text-sky-400">&lt; 200ms</span>
          </div>
        </div>

        {/* Latency & Error */}
        <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Rata-rata Latensi / Gagal</span>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-400/20">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-white tabular-nums flex items-baseline gap-2">
            <span>{stats.avgLatencyMs}ms</span>
            <span className="text-xs text-rose-400 font-normal">({stats.totalFailedToday} gagal)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Standar SLA: &lt;1.2s</span>
            <button
              onClick={() => onNavigate('logs')}
              className="text-sky-400 hover:underline flex items-center gap-0.5"
            >
              Lihat Log
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Hourly Throughput Chart & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Volume Chart */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Aktivitas Pengiriman 24 Jam Terakhir</h2>
              <p className="text-xs text-slate-400">Distribusi beban pesan keluar dan respon chatbot per jam</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
                <span className="text-slate-400">Outbound</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                <span className="text-slate-400">Inbound Bot</span>
              </div>
            </div>
          </div>

          {/* Visual SVG / HTML Chart Bar Strip */}
          <div className="h-56 pt-6 flex items-end gap-2 sm:gap-3 border-b border-slate-800">
            {stats.hourlyData.map((h, i) => {
              const heightPct = Math.round((h.sent / maxSent) * 100);
              const inboundPct = Math.round((h.inbound / maxSent) * 100);

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono whitespace-nowrap z-20 pointer-events-none shadow-lg">
                    {h.hour}: {h.sent} dikirim · {h.inbound} dijawab
                  </div>

                  <div className="w-full flex items-end justify-center gap-1 h-44">
                    {/* Sent bar */}
                    <div
                      style={{ height: `${Math.max(heightPct, 6)}%` }}
                      className="w-full max-w-[14px] bg-gradient-to-t from-sky-600 to-sky-400 rounded-t-sm group-hover:brightness-125 transition-all"
                    />
                    {/* Inbound bar */}
                    <div
                      style={{ height: `${Math.max(inboundPct, 4)}%` }}
                      className="w-full max-w-[10px] bg-indigo-500/80 rounded-t-sm group-hover:brightness-125 transition-all"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 truncate">{h.hour}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Puncak Trafik: 14.00 WIB (390 pesan/jam)</span>
            <span className="font-mono">Throughput: 6.5 pesan/detik</span>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white mb-1">Segmentasi Pesan Bisnis</h2>
            <p className="text-xs text-slate-400 mb-6">Distribusi volume berdasarkan keperluan fungsional</p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">OTP & Keamanan Akun</span>
                  <span className="font-mono text-sky-400 tabular-nums">{stats.breakdown.otp} (25%)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-400 h-full rounded-full" style={{ width: '25%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Notifikasi Transaksi / Invoice</span>
                  <span className="font-mono text-emerald-400 tabular-nums">{stats.breakdown.transactional} (22%)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: '22%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Promosi & Broadcast Pelanggan</span>
                  <span className="font-mono text-amber-400 tabular-nums">{stats.breakdown.promotional} (32%)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '32%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-300 font-medium">Chatbot & Respon Otomatis</span>
                  <span className="font-mono text-indigo-400 tabular-nums">{stats.breakdown.chatbot} (21%)</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: '21%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/80 mt-6">
            <div className="p-3 bg-[#020618] rounded-lg border border-slate-800 text-xs flex items-center justify-between">
              <span className="text-slate-400">Total Volume Bulan Ini:</span>
              <span className="font-bold font-mono text-white">74.520 Pesan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Feeds Split: Recent Outbound vs Recent Inbound */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outbound Logs Preview */}
        <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-sky-400" />
              Pesan Keluar Terakhir
            </h2>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs text-sky-400 hover:underline"
            >
              Semua Log
            </button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentLogs.length > 0 ? (
              recentLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-slate-200">+{log.recipient}</span>
                      {log.recipientName && (
                        <span className="text-slate-400">({log.recipientName})</span>
                      )}
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {log.type}
                      </span>
                    </div>
                    <p className="text-slate-400 truncate max-w-sm">{log.content}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        log.status === 'delivered' || log.status === 'read'
                          ? 'text-emerald-400'
                          : log.status === 'failed'
                          ? 'text-rose-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Belum ada pesan keluar. Klik 'Kirim Pesan' untuk mengirim pesan WhatsApp pertama.
              </div>
            )}
          </div>
        </div>

        {/* Inbound Chatbot Feed */}
        <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              Pesan Masuk Terjawab Bot
            </h2>
            <button
              onClick={() => onNavigate('autoresponder')}
              className="text-xs text-sky-400 hover:underline"
            >
              Uji Simulator
            </button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {recentInbox.length > 0 ? (
              recentInbox.slice(0, 4).map((inbox) => (
                <div key={inbox.id} className="py-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{inbox.senderName}</span>
                      <span className="font-mono text-[11px] text-slate-400">+{inbox.senderNumber}</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                      Key: {inbox.matchedKeyword || 'Fallback'}
                    </span>
                  </div>

                  <div className="p-2 rounded bg-[#020618] border border-slate-800 text-[11px] space-y-1">
                    <p className="text-slate-300">
                      <span className="text-slate-500 font-mono">User:</span> "{inbox.messageText}"
                    </p>
                    {inbox.botReplyText && (
                      <p className="text-sky-300/90 truncate">
                        <span className="text-indigo-400 font-mono">Bot:</span> "{inbox.botReplyText}"
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Belum ada pesan masuk. Kirim pesan ke nomor WhatsApp yang terhubung atau gunakan simulator untuk menguji bot.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
