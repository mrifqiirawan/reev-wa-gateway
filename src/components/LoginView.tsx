import React, { useState } from 'react';
import {
  Lock,
  User,
  Zap,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  KeyRound
} from 'lucide-react';
import { apiService } from '../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: { username: string; role: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiService.login(username.trim(), password);
      if (res.success) {
        onLoginSuccess(res.user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Username atau password salah';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020618] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-400/30 items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.3)] mb-2">
            <Zap className="w-7 h-7 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            REEV WA
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
              Gateway
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Portal Keamanan & Admin Gateway Produksi
          </p>
        </div>

        {/* Login Card */}
        <div className="p-8 rounded-2xl bg-[#0b1229] border border-slate-800/80 shadow-[0_0_40px_rgba(2,6,24,0.9)] space-y-6">
          <div className="border-b border-slate-800/80 pb-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Autentikasi Akses Admin
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Masukkan kredensial admin Anda untuk membuka dashboard.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username Admin
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-[#020618] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password Admin
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#020618] border border-slate-800 rounded-lg pl-9 pr-10 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 active:scale-98 disabled:opacity-50 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Masuk ke Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500 font-mono">
          REEV WA Gateway v2.7.0 · Sesi persisten dengan cookie HttpOnly
        </div>
      </div>
    </div>
  );
};
