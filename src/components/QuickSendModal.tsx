import React, { useState } from 'react';
import { X, Send, KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';
import { DeviceSession } from '../types/gateway';

interface QuickSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceSession[];
  onSuccess: () => void;
}

export const QuickSendModal: React.FC<QuickSendModalProps> = ({
  isOpen,
  onClose,
  devices,
  onSuccess,
}) => {
  const [recipient, setRecipient] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'otp'>('text');
  const [message, setMessage] = useState('');
  const [otpCode, setOtpCode] = useState('849201');
  const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id || 'device_primary');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    messageId?: string;
    error?: string;
    latencyMs?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerateOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(code);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient) return;

    setLoading(true);
    setResult(null);

    try {
      if (messageType === 'otp') {
        const res = await apiService.sendOtp({
          recipient,
          otpCode,
          serviceName: 'REEV WA Gateway',
          expiresInMinutes: 5,
        });
        setResult({
          success: true,
          messageId: res.messageId,
          latencyMs: res.latencyMs,
        });
      } else {
        const res = await apiService.sendMessage({
          recipient,
          message,
          deviceId: selectedDevice,
        });
        setResult({
          success: true,
          messageId: res.messageId,
          latencyMs: res.latencyMs,
        });
      }
      onSuccess();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal mengirim pesan';
      setResult({
        success: false,
        error: errMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#0b1229] border border-slate-800 rounded-xl w-full max-w-lg shadow-[0_0_30px_rgba(2,6,24,0.9)] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-white">Kirim Pesan Cepat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSend} className="p-6 space-y-4">
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#020618] rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setMessageType('text')}
              className={`py-2 text-xs font-semibold rounded-md transition-all ${
                messageType === 'text'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pesan Teks Biasa
            </button>
            <button
              type="button"
              onClick={() => setMessageType('otp')}
              className={`py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                messageType === 'otp'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Kode OTP Transaksi
            </button>
          </div>

          {/* Device Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Pilih Perangkat Pengirim
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.phone || 'Sesi Aktif'}) - {d.status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Input */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Nomor WhatsApp Tujuan (Gunakan kode negara, contoh: 6281234567890)
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: 6281298765432"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Dynamic Message Content */}
          {messageType === 'text' ? (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Isi Pesan WhatsApp
              </label>
              <textarea
                rows={4}
                required
                placeholder="Tuliskan pesan notifikasi transaksi, konfirmasi order, atau pengumuman..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 resize-none font-sans"
              />
            </div>
          ) : (
            <div className="p-3 bg-[#020618] border border-slate-800 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Kode OTP 6 Digit:</span>
                <button
                  type="button"
                  onClick={handleGenerateOtp}
                  className="text-xs text-sky-400 hover:underline"
                >
                  Acak Ulang
                </button>
              </div>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full text-center text-2xl font-mono font-bold tracking-widest text-sky-400 bg-slate-900 border border-slate-700 rounded-lg py-2"
              />
              <p className="text-[11px] text-slate-500">
                Pesan akan diformat otomatis menggunakan template resmi OTP REEV berlatensi ultra-rendah.
              </p>
            </div>
          )}

          {/* Result Alert */}
          {result && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                result.success
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {result.success ? 'Pesan Berhasil Terkirim ke WhatsApp!' : 'Pengiriman Gagal'}
                </p>
                {result.success ? (
                  <p className="font-mono text-[11px] text-emerald-400/90">
                    ID: {result.messageId} · Latensi: {result.latencyMs}ms
                  </p>
                ) : (
                  <p className="text-[11px] text-rose-400/90">{result.error}</p>
                )}
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 active:scale-98 disabled:opacity-50 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Sekarang</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
