import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  RotateCw,
  CheckCircle2,
  AlertOctagon,
  Clock,
  Download,
  Filter
} from 'lucide-react';
import { MessageLog } from '../../types/gateway';
import { apiService } from '../../services/api';

interface ErrorLogsViewProps {
  logs: MessageLog[];
  onRefresh: () => void;
}

export const ErrorLogsView: React.FC<ErrorLogsViewProps> = ({ logs, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      await apiService.retryLog(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setRetryingId(null);
    }
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reev_wa_message_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.recipient.includes(search) ||
      (log.recipientName && log.recipientName.toLowerCase().includes(search.toLowerCase())) ||
      log.content.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || log.status === statusFilter;

    const matchesType =
      typeFilter === 'all' || log.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const failedCount = logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Monitoring Log Error & Riwayat Pengiriman
          </h2>
          <p className="text-xs text-slate-400">
            SENT: proses kirim selesai, belum ada bukti penerimaan. DELIVERED: receipt diterima. READ: receipt baca diterima. Latensi adalah waktu proses kirim, bukan waktu sampai.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor Log JSON
          </button>
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Alert Box if any failures */}
      {failedCount > 0 && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-300">
                Terdeteksi {failedCount} Pesan Gagal Memerlukan Tindakan
              </span>
              <p className="text-rose-400/80 text-[11px]">
                Umumnya disebabkan oleh nomor tidak terdaftar WhatsApp, timeout jaringan, atau format nomor tanpa kode negara.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('failed')}
            className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-semibold whitespace-nowrap"
          >
            Filter Gagal Saja
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0b1229] border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor HP, nama atau isi pesan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#020618] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#020618] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="all">Semua Status</option>
              <option value="failed">Gagal (FAILED)</option>
              <option value="delivered">Terkirim (DELIVERED)</option>
              <option value="read">Dibaca (READ)</option>
              <option value="sent">Terkirim ke Server</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-mono text-[11px]">Tipe:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#020618] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="all">Semua Tipe</option>
              <option value="otp">OTP</option>
              <option value="text">Teks Transaksional</option>
              <option value="broadcast">Broadcast Massal</option>
              <option value="auto_reply">Auto-Reply Bot</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl bg-[#0b1229] border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070e24] text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3">Penerima</th>
                <th className="px-5 py-3">Tipe</th>
                <th className="px-5 py-3">Isi Pesan</th>
                <th className="px-5 py-3">Status & Diagnostik</th>
                <th className="px-5 py-3">Latensi</th>
                <th className="px-5 py-3">Waktu</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredLogs.map((log) => {
                const isFailed = log.status === 'failed';
                const isSuccess = log.status === 'delivered' || log.status === 'read';

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-900/40 transition-colors"
                  >
                    {/* Recipient */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="font-mono font-medium text-white">+{log.recipient}</div>
                      {log.recipientName && (
                        <div className="text-[11px] text-slate-400">{log.recipientName}</div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        {log.type}
                      </span>
                    </td>

                    {/* Content snippet */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-slate-300 truncate font-sans text-xs">{log.content}</p>
                    </td>

                    {/* Status & Diagnostic Code */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
                            isSuccess
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isFailed
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      {log.errorCode && (
                        <div className="text-[10px] font-mono text-rose-400 mt-1">
                          {log.errorCode}: {log.errorMessage}
                        </div>
                      )}
                    </td>

                    {/* Latency */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono tabular-nums text-slate-400 text-[11px]">
                      {log.latencyMs}ms
                    </td>

                    {/* Timestamp */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      {isFailed ? (
                        <button
                          onClick={() => handleRetry(log.id)}
                          disabled={retryingId === log.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded text-xs font-medium transition-colors"
                        >
                          <RotateCw
                            className={`w-3 h-3 ${retryingId === log.id ? 'animate-spin' : ''}`}
                          />
                          Retry
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-600 font-mono">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
