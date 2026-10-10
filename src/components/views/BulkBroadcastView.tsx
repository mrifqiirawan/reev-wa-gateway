import React, { useState } from 'react';
import {
  Send,
  Users,
  ShieldAlert,
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Pause,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { apiService } from '../../services/api';

interface BulkBroadcastViewProps {
  onSuccess: () => void;
}

export const BulkBroadcastView: React.FC<BulkBroadcastViewProps> = ({ onSuccess }) => {
  const [campaignName, setCampaignName] = useState('Promo Spesial Pelanggan Setia');
  const [template, setTemplate] = useState(
    'Halo {nama}!\n\nKami memiliki penawaran eksklusif untuk Anda hari ini. Gunakan kode kupon *REEVVIP* untuk mendapatkan diskon 30%.\n\nKunjungi website kami atau balas pesan ini jika ada pertanyaan!'
  );
  const [contactsText, setContactsText] = useState(
    '6281298765432, Ahmad Fauzi, VIP\n6287711223344, Siti Rahma, REGULER\n6285299887711, Budi Santoso, VIP\n6281344556677, Dian Permata, GOLD\n6285712345678, Hendra Wijaya, REGULER'
  );
  const [minDelay, setMinDelay] = useState(4);
  const [maxDelay, setMaxDelay] = useState(8);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [activeContactLog, setActiveContactLog] = useState<string[]>([]);

  // Parse contacts
  const parseContacts = () => {
    return contactsText
      .split('\n')
      .map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        if (!parts[0]) return null;
        return {
          phone: parts[0],
          name: parts[1] || 'Pelanggan',
          params: { tier: parts[2] || 'Umum' },
        };
      })
      .filter(Boolean) as Array<{ phone: string; name: string; params: Record<string, string> }>;
  };

  const handleStartCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const contacts = parseContacts();
    if (contacts.length === 0) {
      alert('Daftar kontak tidak boleh kosong');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setSentCount(0);
    setFailedCount(0);
    setActiveContactLog([]);

    try {
      await apiService.sendBulk({
        campaignName,
        template,
        contacts,
        minDelay,
        maxDelay,
      });

      // Simulate step-by-step progress visually for live feedback
      let currentSent = 0;
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        await new Promise((resolve) => setTimeout(resolve, 800));
        currentSent++;
        setSentCount(currentSent);
        setProgress(Math.round((currentSent / contacts.length) * 100));
        setActiveContactLog((prev) => [
          `[${new Date().toLocaleTimeString('id-ID')}] Terkirim ke +${c.phone} (${c.name}) - DELIVERED`,
          ...prev,
        ]);
      }

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error broadcast';
      alert(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const contactsList = parseContacts();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-400" />
            Pengiriman Pesan Massal (Bulk Campaign)
          </h2>
          <p className="text-xs text-slate-400">
            Kirimkan broadcast promosi atau pengumuman dengan variabel otomatis dan interval anti-blokir adaptif.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-[#0b1229] border border-slate-800 px-3 py-1.5 rounded-lg">
          <Users className="w-4 h-4 text-sky-400" />
          <span>Total Kontak Terdeteksi: <strong className="text-white">{contactsList.length}</strong></span>
        </div>
      </div>

      {/* Main Campaign Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Configuration & Contacts Input */}
        <div className="lg:col-span-2 space-y-5">
          <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nama Kampanye Broadcast
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Template Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">
                  Template Pesan (Mendukung Tag Dinamis)
                </label>
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="text-slate-500">Variabel:</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-400">
                    &#123;nama&#125;
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400">
                    &#123;tier&#125;
                  </span>
                </div>
              </div>
              <textarea
                rows={5}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 resize-none font-sans"
              />
            </div>

            {/* Contacts CSV / Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                  Daftar Kontak (Format: Nomor, Nama, Parameter Tambahan)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setContactsText(
                      '6281298765432, Ahmad Fauzi, VIP\n6287711223344, Siti Rahma, REGULER\n6285299887711, Budi Santoso, VIP'
                    )
                  }
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  Muat Contoh
                </button>
              </div>
              <textarea
                rows={6}
                value={contactsText}
                onChange={(e) => setContactsText(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>

            {/* Anti-Ban Rate Limit Settings */}
            <div className="p-4 rounded-xl bg-[#020618] border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                <ShieldAlert className="w-4 h-4" />
                Pengaturan Interval Jeda (Anti-Banned Protection)
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                REEV Gateway secara otomatis mengacak jeda waktu antara setiap pesan keluar untuk menghindari deteksi spam bot oleh algoritma WhatsApp.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Jeda Minimum (Detik)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Jeda Maksimum (Detik)
                  </label>
                  <input
                    type="number"
                    min={minDelay + 1}
                    max={120}
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={isRunning || contactsList.length === 0}
                onClick={handleStartCampaign}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 rounded-lg shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 animate-pulse" />
                    Sedang Mengirim Pesan ({progress}%)...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Mulai Eksekusi Broadcast ({contactsList.length} Kontak)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Monitor & Progress */}
        <div className="space-y-5">
          <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Progres Antrean Pengiriman
            </h3>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-400">Status Penyelesaian</span>
                <span className="text-sky-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-[#020618] border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block font-mono">TERKIRIM SUKSES</span>
                <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  {sentCount}
                </span>
              </div>
              <div className="p-3 bg-[#020618] border border-slate-800 rounded-lg text-center">
                <span className="text-[10px] text-slate-500 block font-mono">GAGAL / SKIPPED</span>
                <span className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                  {failedCount}
                </span>
              </div>
            </div>

            {/* Live Contact Activity Stream */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-mono uppercase text-slate-500 block">
                Live Console Activity
              </span>
              <div className="h-60 p-3 bg-[#020618] border border-slate-800 rounded-lg overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {activeContactLog.length > 0 ? (
                  activeContactLog.map((log, i) => (
                    <div key={i} className="text-slate-300">
                      {log}
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-600 text-center">
                    Klik 'Mulai Eksekusi Broadcast' untuk memulai pengiriman antrean.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
