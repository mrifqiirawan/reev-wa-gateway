/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavView } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/views/DashboardView';
import { DeviceManagerView } from './components/views/DeviceManagerView';
import { AutoResponderView } from './components/views/AutoResponderView';
import { BulkBroadcastView } from './components/views/BulkBroadcastView';
import { InboxView } from './components/views/InboxView';
import { ErrorLogsView } from './components/views/ErrorLogsView';
import { ApiPlaygroundView } from './components/views/ApiPlaygroundView';
import { DocsSdkView } from './components/views/DocsSdkView';
import { SettingsSecurityView } from './components/views/SettingsSecurityView';
import { LoginView } from './components/LoginView';
import { QuickSendModal } from './components/QuickSendModal';
import { apiService } from './services/api';
import {
  DeviceSession,
  AnalyticsSummary,
  MessageLog,
  InboxMessage,
  AutoResponderRule,
  WebhookConfig,
} from './types/gateway';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<{ username: string; role: string } | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Navigation & UI State
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isQuickSendOpen, setIsQuickSendOpen] = useState(false);

  // Core Data Stores
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [rules, setRules] = useState<AutoResponderRule[]>([]);
  const [fallbackConfig, setFallbackConfig] = useState({
    isEnabled: true,
    replyMessage: `Mohon maaf {sender_name}, pesan yang Anda kirimkan belum dikenali oleh sistem kami.\n\nKetik *MENU* untuk melihat opsi bantuan atau hubungi tim support kami.`,
    delayMs: 800,
  });
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(null);

  // Check saved session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiService.verifyAuth();
        if (res.success && res.user) {
          setIsAuthenticated(true);
          setAdminUser(res.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch all gateway states
  const refreshAllData = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const [devRes, analyticsRes, logsRes, inboxRes, rulesRes, whRes] =
        await Promise.all([
          apiService.getDevices().catch(() => ({ success: true, devices: [] })),
          apiService.getAnalytics().catch(() => null),
          apiService.getLogs({ limit: 50 }).catch(() => ({ success: true, total: 0, logs: [] })),
          apiService.getInbox().catch(() => ({ success: true, inbox: [] })),
          apiService.getAutoResponderRules().catch(() => ({
            success: true,
            rules: [],
            fallback: fallbackConfig,
          })),
          apiService.getWebhookConfig().catch(() => null),
        ]);

      if (devRes?.devices) setDevices(devRes.devices);
      if (analyticsRes) setAnalytics(analyticsRes);
      if (logsRes?.logs) setLogs(logsRes.logs);
      if (inboxRes?.inbox) setInbox(inboxRes.inbox);
      if (rulesRes?.rules) setRules(rulesRes.rules);
      if (rulesRes?.fallback) setFallbackConfig(rulesRes.fallback);
      if (whRes?.webhook) setWebhookConfig(whRes.webhook);
    } catch (err) {
      console.error('Error fetching REEV Gateway data:', err);
    }
  }, [isAuthenticated, fallbackConfig]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
      const interval = setInterval(refreshAllData, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, refreshAllData]);

  const handleLogout = async () => {
    await apiService.logout();
    setIsAuthenticated(false);
    setAdminUser(null);
  };

  const connectedDevicesCount = devices.filter((d) => d.status === 'connected').length;

  // Render Loading Splash during auth check
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#020618] flex items-center justify-center text-slate-400 font-mono text-xs">
        Memverifikasi sesi keamanan REEV Gateway...
      </div>
    );
  }

  // Render Login Gate if unauthenticated
  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setIsAuthenticated(true);
          setAdminUser(user);
        }}
      />
    );
  }

  // Render Full Dashboard once authenticated
  return (
    <div className="min-h-screen bg-[#020618] text-slate-100 flex flex-col font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        isOpenMobile={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
        connectedCount={connectedDevicesCount}
        onLogout={handleLogout}
        currentUsername={adminUser?.username || 'admin'}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        {/* Sticky 3-zone Header */}
        <Header
          currentView={currentView}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          onOpenQuickSend={() => setIsQuickSendOpen(true)}
          connectedCount={connectedDevicesCount}
        />

        {/* View Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              analytics={analytics}
              recentLogs={logs}
              recentInbox={inbox}
              onNavigate={(view) => setCurrentView(view as NavView)}
            />
          )}

          {currentView === 'devices' && (
            <DeviceManagerView
              devices={devices}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'autoresponder' && (
            <AutoResponderView
              rules={rules}
              fallbackConfig={fallbackConfig}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'broadcast' && (
            <BulkBroadcastView onSuccess={refreshAllData} />
          )}

          {currentView === 'inbox' && (
            <InboxView inbox={inbox} onRefresh={refreshAllData} />
          )}

          {currentView === 'logs' && (
            <ErrorLogsView logs={logs} onRefresh={refreshAllData} />
          )}

          {currentView === 'api' && (
            <ApiPlaygroundView
              webhookConfig={webhookConfig}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'docs' && <DocsSdkView />}

          {currentView === 'settings' && (
            <SettingsSecurityView
              currentUsername={adminUser?.username || 'admin'}
              onUpdateUsername={(newUsername) =>
                setAdminUser((prev) =>
                  prev ? { ...prev, username: newUsername } : { username: newUsername, role: 'admin' }
                )
              }
            />
          )}
        </main>
      </div>

      {/* Quick Send Message Dialog */}
      <QuickSendModal
        isOpen={isQuickSendOpen}
        onClose={() => setIsQuickSendOpen(false)}
        devices={devices}
        onSuccess={refreshAllData}
      />
    </div>
  );
}
