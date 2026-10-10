import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  User,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Server,
  Eye,
  EyeOff
} from 'lucide-react';
import { apiService } from '../../services/api';

interface SettingsSecurityViewProps {
  currentUsername: string;
  onUpdateUsername: (newUsername: string) => void;
}

export const SettingsSecurityView: React.FC<SettingsSecurityViewProps> = ({
  currentUsername,
  onUpdateUsername,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState(currentUsername);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!currentPassword) {
      setErrorMsg('Password saat ini wajib diisi untuk konfirmasi keamanan');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok');
      return;
    }

    if (newPassword && newPassword.length < 4) {
      setErrorMsg('Password baru minimal 4 karakter');
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.changeCredentials({
        currentPassword,
        newUsername: newUsername.trim() !== currentUsername ? newUsername.trim() : undefined,
        newPassword: newPassword ? newPassword : undefined,
      });

      if (res.success) {
        setSuccessMsg('Kredensial login admin berhasil diperbarui dan disimpan!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (res.username) {
          onUpdateUsername(res.username);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui kredensial';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          Pengaturan Keamanan & Kredensial Login
        </h2>
        <p className="text-xs text-slate-400">
          Ubah username dan password login admin agar gateway Anda terlindungi dari akses publik yang tidak sah.
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 shadow-lg space-y-6">
        {/* Active Account Status */}
        <div className="p-4 rounded-xl bg-[#020618] border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center">
              <User className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Akun Administrator Aktif</div>
              <div className="text-xs font-mono text-slate-400">
                Username saat ini: <span className="text-sky-300 font-semibold">{currentUsername}</span>
              </div>
            </div>
          </div>

          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
            Superadmin
          </span>
        </div>

        {/* Success / Error Alerts */}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Ubah Kredensial */}
        <form onSubmit={handleSaveCredentials} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* New Username */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username Baru
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Gunakan minimal 3 karakter tanpa spasi.
              </p>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password Saat Ini (Wajib untuk Verifikasi)
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan password saat ini (default: admin123)"
                  className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 pr-10 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-white"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password Baru (Kosongkan jika tidak ingin diubah)
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password baru Anda"
                  className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 pr-10 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-white"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Ulangi Password Baru
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 active:scale-98 disabled:opacity-50 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Perubahan...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Simpan Kredensial Baru</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security Best Practices Explainer */}
      <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-3 text-xs">
        <div className="flex items-center gap-2 text-white font-bold">
          <Server className="w-4 h-4 text-sky-400" />
          Rekomendasi Keamanan Setelah Deployment:
        </div>
        <ul className="list-disc list-inside space-y-1.5 text-slate-400 leading-relaxed">
          <li>Segera ganti password default (<code className="text-sky-300 font-mono">admin123</code>) menjadi password yang kuat (kombinasi huruf besar, kecil, angka, dan simbol).</li>
          <li>Kredensial disimpan secara persisten di file <code className="text-sky-300 font-mono">sessions/admin_auth.json</code> di server Anda sehingga tidak akan ter-reset saat restart.</li>
          <li>Pastikan tidak membagikan token login atau file kredensial kepada pihak yang tidak berwenang.</li>
          <li>Untuk deployment di VPS publik, disarankan mengaktifkan SSL/HTTPS melalui Nginx Reverse Proxy dan certbot Let's Encrypt.</li>
        </ul>
      </div>
    </div>
  );
};
