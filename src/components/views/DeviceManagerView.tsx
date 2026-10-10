import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Plus,
  QrCode,
  KeyRound,
  RefreshCw,
  Trash2,
  Download,
  CheckCircle2,
  Battery,
  Clock,
  Server,
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { DeviceSession } from '../../types/gateway';
import { apiService } from '../../services/api';

interface DeviceManagerViewProps {
  devices: DeviceSession[];
  onRefresh: () => void;
}

export const DeviceManagerView: React.FC<DeviceManagerViewProps> = ({
  devices,
  onRefresh,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveDevices, setLiveDevices] = useState(devices);
  const selectedDevice = liveDevices.find(d => d.id === selectedId) || liveDevices[0] || null;
  const [error, setError] = useState<string | null>(null);
  const setSelectedDevice = (device: DeviceSession | null) => setSelectedId(device?.id || null);
  useEffect(() => { setLiveDevices(devices); }, [devices]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await apiService.getDevices();
        if (!stopped) { setLiveDevices(result.devices); setError(null); }
      } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : 'Backend tidak dapat dijangkau'); }
      if (!stopped) timer = setTimeout(poll, 2500);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);
  const [isCreating, setIsCreating] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDevicePhone, setNewDevicePhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedPairing, setCopiedPairing] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiService.createDevice(
        newDeviceName || `REEV Bot ${devices.length + 1}`,
        newDevicePhone
      );
      setIsCreating(false);
      setNewDeviceName('');
      setNewDevicePhone('');
      onRefresh();
      setLiveDevices([res.device]);
      setSelectedDevice(res.device);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async (id: string) => {
    try {
      setError(null);
      const result = await apiService.reconnectDevice(id);
      setLiveDevices([result.device]);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operasi gagal');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin memutuskan dan menghapus sesi ini?')) return;
    try {
      await apiService.deleteDevice(id);
      onRefresh();
      if (selectedDevice?.id === id) {
        setSelectedDevice(devices.find(d => d.id !== id) || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operasi gagal');
    }
  };

  const handleExportCreds = (device: DeviceSession) => {
    const credsData = {
      sessionId: device.id, deviceName: device.name, phone: device.phone,
      platform: device.platform, exportedAt: new Date().toISOString(),
      note: 'Metadata perangkat saja, bukan backup sesi. Backup DATA_DIR pada backend untuk pemulihan.',
    };
    const blob = new Blob([JSON.stringify(credsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reev_wa_session_${device.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPairingCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedPairing(true);
    setTimeout(() => setCopiedPairing(false), 2000);
  };

  return (
    <div className="space-y-6">
      {(error || selectedDevice?.lastError) && <div role="alert" className="p-3 rounded-lg bg-rose-950 text-rose-200 text-sm">{error || selectedDevice?.lastError}</div>}
      {/* Top Controls Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-sky-400" />
            Manajemen Sesi WhatsApp Multi-Device
          </h2>
          <p className="text-xs text-slate-400">
            Sesi disimpan secara persisten di server (`./sessions`). Tidak perlu scan ulang setiap restart.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
          >
            <Plus className="w-4 h-4" />
            Tambah Perangkat Baru
          </button>
        </div>
      </div>

      {/* Modal Tambah Perangkat */}
      {isCreating && (
        <div className="p-5 rounded-xl bg-[#0b1229] border border-sky-500/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Inisialisasi Sesi Baileys Baru</h3>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Batal
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nama Perangkat / Label</label>
              <input
                type="text"
                placeholder="Contoh: CS Toko Utama / Bot Promo"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nomor WhatsApp (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: 6281234567890"
                value={newDevicePhone}
                onChange={(e) => setNewDevicePhone(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                Generate QR & Pairing Code
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Devices List & Active QR Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Devices Column (Left) */}
        <div className="space-y-3">
          <div className="text-xs font-mono uppercase text-slate-400 px-1">
            Daftar Perangkat Terdaftar ({devices.length})
          </div>

          {liveDevices.map((device) => {
            const isSelected = selectedDevice?.id === device.id;
            const isConnected = device.status === 'connected';

            return (
              <div
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-sky-950/20 border-sky-400/50 shadow-[0_0_15px_rgba(56,189,248,0.15)]'
                    : 'bg-[#0b1229] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{device.name}</h3>
                      <p className="font-mono text-[11px] text-slate-400">{device.phone || 'Belum terautentikasi'}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      isConnected
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {device.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <Battery className="w-3 h-3 text-slate-400" />
                    {device.batteryLevel}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {Math.round(device.uptimeSeconds / 3600)} jam uptime
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Device Detail & QR Connection Studio (Right) */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{selectedDevice.name}</h3>
                    {selectedDevice.isDefault && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-400/30">
                        DEFAULT SENDER
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: {selectedDevice.id} · {selectedDevice.platform}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportCreds(selectedDevice)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded-lg transition-colors"
                    title="Export auth creds JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Backup Sesi
                  </button>
                  <button
                    onClick={() => handleReconnect(selectedDevice.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-700 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reconnect
                  </button>
                  <button
                    onClick={() => handleDelete(selectedDevice.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-900/50 rounded-lg transition-colors"
                    title="Hapus sesi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Display: Connected vs QR Scan */}
              {selectedDevice.status === 'connected' ? (
                <div className="p-6 rounded-xl bg-gradient-to-b from-[#020618] to-[#070e24] border border-emerald-500/20 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">WhatsApp Terhubung Aktif</h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      Nomor: <span className="text-emerald-300 font-semibold">{selectedDevice.phone}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-2 max-w-md">
                      Sesi ini siap menerima pesan masuk untuk chatbot otomatis dan mengirimkan broadcast/OTP ke ribuan pelanggan.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg pt-4 text-xs font-mono">
                    <div className="p-3 bg-[#0b1229] border border-slate-800 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">AUTH STORE</span>
                      <span className="text-slate-200">Local Multi-File</span>
                    </div>
                    <div className="p-3 bg-[#0b1229] border border-slate-800 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">AUTO-RECONNECT</span>
                      <span className="text-emerald-400">Aktif (Backoff)</span>
                    </div>
                    <div className="p-3 bg-[#0b1229] border border-slate-800 rounded-lg col-span-2 sm:col-span-1">
                      <span className="text-slate-500 block text-[10px]">SOCKET STATE</span>
                      <span className="text-sky-400">Open (24/7)</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* QR Code & Pairing Code Studio */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Left: QR Code Display */}
                  <div className="flex flex-col items-center p-6 bg-[#020618] border border-slate-800 rounded-xl space-y-3">
                    <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-sky-400" />
                      Pilihan 1: Scan QR Code
                    </span>

                    {selectedDevice.qrCode ? (
                      <div className="p-3 bg-white rounded-lg shadow-lg">
                        <img
                          src={selectedDevice.qrCode}
                          alt="QR Code WhatsApp Pairing"
                          className="w-48 h-48 block"
                        />
                      </div>
                    ) : (
                      <div className="w-48 h-48 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center">
                        {selectedDevice.status === 'connecting' ? <Loader2 className="w-8 h-8 text-sky-400 animate-spin" /> : <span className="text-xs p-4 text-center text-slate-400">Klik Minta QR Baru untuk menautkan WhatsApp.</span>}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 text-center max-w-xs">
                      Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat, lalu arahkan kamera ke QR di atas.
                    </p>

                    <button
                      onClick={() => handleReconnect(selectedDevice.id)}
                      className="px-3 py-1.5 text-xs text-sky-400 hover:text-sky-300 bg-slate-900 border border-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Minta QR Baru (Baileys)
                    </button>
                  </div>

                  {/* Right: Pairing Code (No Camera) */}
                  <div className="p-6 bg-[#020618] border border-slate-800 rounded-xl space-y-4">
                    <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-indigo-400" />
                      Pilihan 2: Pairing Code 8-Digit (Tanpa Kamera)
                    </span>

                    <p className="text-xs text-slate-400">
                      Jika kamera rusak atau server berada di lokasi jarak jauh, gunakan kode tautan ini di aplikasi WhatsApp Anda:
                    </p>

                    <div className="p-4 bg-slate-900/90 border border-slate-700 rounded-xl flex items-center justify-between">
                      <span className="text-2xl font-mono font-bold tracking-widest text-sky-400">
                        {selectedDevice.pairingCode || 'Belum tersedia'}
                      </span>
                      <button
                        disabled={!selectedDevice.pairingCode}
                        onClick={() => handleCopyPairingCode(selectedDevice.pairingCode || 'Belum tersedia')}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
                      >
                        {copiedPairing ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-1">
                      <p>1. Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan dengan nomor telepon</p>
                      <p>2. Masukkan 8 karakter kode pairing di atas.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Persistent Session Architecture Explainer */}
              <div className="p-4 rounded-lg bg-[#020618] border border-slate-800 text-xs space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-semibold">
                  <Server className="w-4 h-4" />
                  Mengapa REEV WA Gateway Tidak Memerlukan Scan QR Berulang Kali?
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Engine Baileys kami mengisolasi autentikasi kunci kriptografi Noise & Multi-Device ke dalam folder storage terenkripsi lokal. Setiap kali Anda merestart server Node.js atau Docker container di Dewaweb/VPS, kredensial dibaca seketika dan handshake soket dipulihkan otomatis dalam 800ms.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-xl bg-[#0b1229] border border-slate-800 text-center text-slate-500 text-xs">
              Pilih perangkat di panel kiri atau buat perangkat baru.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
