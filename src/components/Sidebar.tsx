import React from 'react';
import {
  LayoutDashboard,
  Smartphone,
  Send,
  Bot,
  Inbox,
  AlertTriangle,
  Terminal,
  BookOpen,
  Radio,
  Zap,
  X,
  ShieldCheck,
  LogOut
} from 'lucide-react';

export type NavView =
  | 'dashboard'
  | 'devices'
  | 'broadcast'
  | 'autoresponder'
  | 'inbox'
  | 'logs'
  | 'api'
  | 'docs'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  connectedCount: number;
  onLogout?: () => void;
  currentUsername?: string;
}

interface MenuItem {
  id: NavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isHot?: boolean;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  connectedCount,
  onLogout,
  currentUsername = 'admin',
}) => {
  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard Analitik', icon: LayoutDashboard },
    { id: 'devices', label: 'Perangkat & Sesi', icon: Smartphone, badge: connectedCount > 0 ? `${connectedCount} Aktif` : 'Offline' },
    { id: 'autoresponder', label: 'Auto-Responder & Bot', icon: Bot, isHot: true },
    { id: 'broadcast', label: 'Pesan Massal (Bulk)', icon: Send },
    { id: 'inbox', label: 'Pesan Masuk (Inbox)', icon: Inbox },
    { id: 'logs', label: 'Log Error & Pengiriman', icon: AlertTriangle },
    { id: 'api', label: 'API & Webhook', icon: Terminal },
    { id: 'docs', label: 'Panduan & SDK', icon: BookOpen },
    { id: 'settings', label: 'Keamanan & Akun', icon: ShieldCheck },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#020618] border-r border-slate-800/80 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="h-18 px-6 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-400/30 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.25)]">
              <Zap className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                REEV WA
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30">
                  Gateway
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono tracking-tight">Baileys Multi-Device</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-white rounded-md lg:hidden"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Navigasi Utama
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id as NavView);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-400/30 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-sky-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.isHot && (
                  <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded border border-sky-400/30">
                    Auto-Reply
                  </span>
                )}

                {item.badge && (
                  <span
                    className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded ${
                      connectedCount > 0
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Engine Status & Logout Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-[#070e24]/70 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              Protokol WhatsApp
            </span>
            <span className="font-mono text-slate-300 font-medium text-[11px]">Gateway v2.7.1</span>
          </div>

          {onLogout && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs truncate">
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px]">
                  A
                </div>
                <span className="font-mono text-slate-300 truncate text-[11px]">
                  {currentUsername}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-2 py-1 rounded transition-colors"
                title="Keluar dari sesi admin"
              >
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
