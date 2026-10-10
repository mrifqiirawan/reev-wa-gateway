import React, { useState } from 'react';
import {
  Bot,
  Plus,
  Play,
  Settings2,
  Trash2,
  Edit2,
  Send,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  User,
  Clock
} from 'lucide-react';
import { AutoResponderRule, MatchType } from '../../types/gateway';
import { apiService } from '../../services/api';

interface AutoResponderViewProps {
  rules: AutoResponderRule[];
  fallbackConfig: { isEnabled: boolean; replyMessage: string; delayMs: number };
  onRefresh: () => void;
}

export const AutoResponderView: React.FC<AutoResponderViewProps> = ({
  rules,
  fallbackConfig,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'simulator' | 'fallback'>('rules');

  // Rule Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('contains');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [actionType, setActionType] = useState<'reply_text' | 'reply_menu' | 'forward_webhook'>('reply_text');
  const [webhookUrl, setWebhookUrl] = useState('');

  // Fallback Form State
  const [fallbackEnabled, setFallbackEnabled] = useState(fallbackConfig.isEnabled);
  const [fallbackMessage, setFallbackMessage] = useState(fallbackConfig.replyMessage);
  const [savingFallback, setSavingFallback] = useState(false);

  // Simulator State
  const [simSenderName, setSimSenderName] = useState('Rian Saputra');
  const [simSenderPhone, setSimSenderPhone] = useState('6281298765432');
  const [simInputMessage, setSimInputMessage] = useState('');
  const [simChatHistory, setSimChatHistory] = useState<Array<{
    sender: 'user' | 'bot';
    text: string;
    timestamp: string;
    matchedKeyword?: string;
  }>>([
    {
      sender: 'user',
      text: 'halo',
      timestamp: '10:14 WIB',
    },
    {
      sender: 'bot',
      text: 'Halo Rian Saputra! Selamat Pagi 🙏\n\nSelamat datang di Layanan Otomatis REEV WA Gateway.\nSilakan pilih menu bantuan berikut:\n\n1️⃣ Cek Status Pesanan\n2️⃣ Layanan OTP\n3️⃣ Info API\n4️⃣ Customer Support',
      timestamp: '10:14 WIB',
      matchedKeyword: 'halo',
    }
  ]);
  const [simLoading, setSimLoading] = useState(false);

  // Open Form for New Rule
  const handleOpenNewRule = () => {
    setEditingId(null);
    setTitle('');
    setMatchType('contains');
    setKeywordsInput('');
    setReplyMessage('');
    setActionType('reply_text');
    setWebhookUrl('');
    setIsEditing(true);
  };

  // Open Form for Edit Rule
  const handleOpenEdit = (rule: AutoResponderRule) => {
    setEditingId(rule.id);
    setTitle(rule.title);
    setMatchType(rule.matchType);
    setKeywordsInput(rule.keywords.join(', '));
    setReplyMessage(rule.replyMessage);
    setActionType(rule.actionType);
    setWebhookUrl(rule.webhookUrl || '');
    setIsEditing(true);
  };

  // Save Rule (Create or Update)
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = keywordsInput.split(',').map(k => k.trim()).filter(Boolean);

    try {
      if (editingId) {
        await apiService.updateAutoResponderRule(editingId, {
          title,
          matchType,
          keywords,
          replyMessage,
          actionType,
          webhookUrl: webhookUrl || undefined,
        });
      } else {
        await apiService.createAutoResponderRule({
          title,
          matchType,
          keywords,
          replyMessage,
          actionType,
          webhookUrl: webhookUrl || undefined,
        });
      }
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm('Hapus aturan auto-responder ini?')) return;
    try {
      await apiService.deleteAutoResponderRule(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Rule Status
  const handleToggleRule = async (rule: AutoResponderRule) => {
    try {
      await apiService.updateAutoResponderRule(rule.id, {
        isEnabled: !rule.isEnabled,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Save Fallback Settings
  const handleSaveFallback = async () => {
    setSavingFallback(true);
    try {
      await apiService.updateFallbackConfig({
        isEnabled: fallbackEnabled,
        replyMessage: fallbackMessage,
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingFallback(false);
    }
  };

  // Send Simulation Message
  const handleSimulateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInputMessage.trim() || simLoading) return;

    const userText = simInputMessage.trim();
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // Add user message to simulation stream
    const updatedHistory = [
      ...simChatHistory,
      { sender: 'user' as const, text: userText, timestamp: nowTime }
    ];
    setSimChatHistory(updatedHistory);
    setSimInputMessage('');
    setSimLoading(true);

    try {
      const res = await apiService.simulateInboundMessage({
        incomingMessage: userText,
        senderName: simSenderName,
        senderNumber: simSenderPhone,
      });

      if (res.replyText) {
        setSimChatHistory([
          ...updatedHistory,
          {
            sender: 'bot' as const,
            text: res.replyText,
            timestamp: nowTime,
            matchedKeyword: res.matchedKeyword,
          }
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSimLoading(false);
    }
  };

  // Insert Variable Snippet into Reply Text
  const insertVariable = (variable: string) => {
    setReplyMessage(prev => prev + variable);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-sky-400" />
            Penerima Pesan Otomatis (Auto-Responder & Chatbot)
          </h2>
          <p className="text-xs text-slate-400">
            WhatsApp yang terhubung akan otomatis membalas setiap pesan masuk sesuai kata kunci, salam dinamis, dan menu pilihan.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#0b1229] border border-slate-800 rounded-lg">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'rules'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Aturan Kata Kunci ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Live Chat Simulator
          </button>
          <button
            onClick={() => setActiveTab('fallback')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'fallback'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pesan Fallback
          </button>
        </div>
      </div>

      {/* Dynamic Variables Cheat Sheet Box */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#070e24] to-[#0b1229] border border-sky-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-sky-300 font-semibold">
          <Sparkles className="w-4 h-4 text-sky-400" />
          Variabel Dinamis yang Didukung:
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-400">
            &#123;sender_name&#125;
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400">
            &#123;greeting&#125;
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400">
            &#123;time&#125;
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-purple-400">
            &#123;date&#125;
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-pink-400">
            &#123;sender_number&#125;
          </span>
        </div>
      </div>

      {/* TAB 1: RULES MANAGEMENT */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">
              Daftar Aturan Respon Aktif
            </span>
            <button
              onClick={handleOpenNewRule}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Aturan Respon
            </button>
          </div>

          {/* Rule Editor Drawer / Modal */}
          {isEditing && (
            <div className="p-6 rounded-xl bg-[#0b1229] border border-sky-500/40 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">
                  {editingId ? 'Edit Aturan Auto-Responder' : 'Buat Aturan Respon Baru'}
                </h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Tutup
                </button>
              </div>

              <form onSubmit={handleSaveRule} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Judul / Label Aturan
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Menu 1 - Cek Pesanan"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Tipe Pencocokan (Match Type)
                    </label>
                    <select
                      value={matchType}
                      onChange={(e) => setMatchType(e.target.value as MatchType)}
                      className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="contains">Mengandung Kata (Contains - Sangat Fleksibel)</option>
                      <option value="exact">Persis Sama (Exact Match - Untuk Pilihan Menu 1, 2, 3)</option>
                      <option value="starts_with">Diawali Kata (Starts With)</option>
                      <option value="regex">Pola Regex (Untuk format ORDER#123)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Kata Kunci Pemicu (Pisahkan dengan tanda koma jika lebih dari satu)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 1, cek resi, lacak paket, resi"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-400">
                      Format Pesan Balasan Otomatis
                    </label>
                    {/* Quick Insert Variable Badges */}
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-slate-500">Sisipkan:</span>
                      <button
                        type="button"
                        onClick={() => insertVariable('{sender_name}')}
                        className="text-sky-400 hover:underline"
                      >
                        +Nama
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('{greeting}')}
                        className="text-emerald-400 hover:underline"
                      >
                        +Salam
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('{time}')}
                        className="text-amber-400 hover:underline"
                      >
                        +Jam
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={5}
                    required
                    placeholder={`Halo {sender_name}! {greeting}.\nBerikut rincian informasi yang Anda butuhkan...`}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 resize-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Aksi Tambahan
                    </label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as any)}
                      className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      <option value="reply_text">Kirim Balasan Teks Langsung</option>
                      <option value="reply_menu">Kirim Menu Interaktif</option>
                      <option value="forward_webhook">Forward ke Webhook URL Backend</option>
                    </select>
                  </div>

                  {actionType === 'forward_webhook' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Webhook Forwarder URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://api.yourdomain.com/wa-bot-handler"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                  >
                    Simpan Aturan
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rules List */}
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 hover:border-slate-700 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        rule.isEnabled ? 'bg-sky-500' : 'bg-slate-800'
                      }`}
                      title={rule.isEnabled ? 'Aktif' : 'Nonaktif'}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          rule.isEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        {rule.title}
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-sky-400">
                          {rule.matchType}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Dipicu {rule.triggerCount} kali · Terakhir:{' '}
                        {rule.lastTriggered
                          ? new Date(rule.lastTriggered).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) + ' WIB'
                          : 'Belum pernah'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(rule)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors"
                      title="Edit aturan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/30 border border-rose-900/50 rounded-lg transition-colors"
                      title="Hapus aturan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Keywords Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 mr-1 font-mono">Kata Kunci:</span>
                  {rule.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="text-xs font-mono px-2 py-0.5 rounded bg-[#020618] border border-slate-800 text-slate-300"
                    >
                      "{kw}"
                    </span>
                  ))}
                </div>

                {/* Message Preview Box */}
                <div className="p-3 bg-[#020618] border border-slate-800/80 rounded-lg text-xs font-sans text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {rule.replyMessage}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE CHAT SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulator Config (Left) */}
          <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-sky-400" />
              Identitas Pengirim Simulasi
            </h3>
            <p className="text-xs text-slate-400">
              Uji bagaimana REEV Auto-Responder menyapa pelanggan dengan nama asli WhatsApp mereka dan salam waktu yang tepat.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nama Pengirim (Simulasi WhatsApp PushName)
              </label>
              <input
                type="text"
                value={simSenderName}
                onChange={(e) => setSimSenderName(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nomor Handphone Pengirim
              </label>
              <input
                type="text"
                value={simSenderPhone}
                onChange={(e) => setSimSenderPhone(e.target.value)}
                className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-800 text-xs text-slate-400 space-y-2">
              <span className="font-semibold text-slate-300 block">Skenario Uji Coba Cepat:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSimInputMessage('menu')}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded hover:border-sky-500 text-[11px] font-mono text-sky-400"
                >
                  "menu"
                </button>
                <button
                  type="button"
                  onClick={() => setSimInputMessage('1')}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded hover:border-sky-500 text-[11px] font-mono text-sky-400"
                >
                  "1" (Order)
                </button>
                <button
                  type="button"
                  onClick={() => setSimInputMessage('2')}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded hover:border-sky-500 text-[11px] font-mono text-sky-400"
                >
                  "2" (OTP)
                </button>
                <button
                  type="button"
                  onClick={() => setSimInputMessage('apakah barang masih ada?')}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded hover:border-rose-500 text-[11px] font-mono text-amber-400"
                >
                  "tanya acak" (Test Fallback)
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Chat Screen (Right) */}
          <div className="lg:col-span-2 rounded-xl bg-[#0b1229] border border-slate-800/80 flex flex-col h-[520px] overflow-hidden">
            {/* WhatsApp Chat Header */}
            <div className="px-5 py-3.5 bg-[#070e24] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    REEV WA Gateway Bot
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Online · Auto-Responder Aktif
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSimChatHistory([])}
                className="text-xs text-slate-400 hover:text-white"
              >
                Bersihkan Layar
              </button>
            </div>

            {/* Chat Bubble Scroll Area */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#020618]/70">
              {simChatHistory.map((item, index) => {
                const isUser = item.sender === 'user';
                return (
                  <div
                    key={index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-md p-3.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-sky-600 text-white rounded-tr-xs'
                          : 'bg-[#0f172a] text-slate-200 border border-slate-800 rounded-tl-xs'
                      }`}
                    >
                      {item.text}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono px-1">
                      <span>{item.timestamp}</span>
                      {item.matchedKeyword && (
                        <span>· Trigger: "{item.matchedKeyword}"</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {simLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono italic">
                  <Bot className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  Bot sedang mengetik balasan...
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSimulateSend}
              className="p-3 bg-[#070e24] border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ketik pesan WhatsApp (misal: halo, 1, 2, dll)..."
                value={simInputMessage}
                onChange={(e) => setSimInputMessage(e.target.value)}
                className="flex-1 bg-[#020618] border border-slate-800 rounded-lg px-4 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={!simInputMessage.trim() || simLoading}
                className="p-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white rounded-lg shadow-sm transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: FALLBACK CONFIGURATION */}
      {activeTab === 'fallback' && (
        <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 max-w-2xl space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              Pesan Fallback Otomatis (Saat Pesan Tidak Dikenali)
            </h3>
            <p className="text-xs text-slate-400">
              Jika pengirim mengirimkan pesan yang tidak cocok dengan kata kunci yang terdaftar, bot akan membalas dengan template ini untuk memandu kembali ke menu utama.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#020618] border border-slate-800 rounded-lg">
            <span className="text-xs text-slate-300 font-medium">Aktifkan Respon Fallback</span>
            <button
              onClick={() => setFallbackEnabled(!fallbackEnabled)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                fallbackEnabled ? 'bg-sky-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  fallbackEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Isi Pesan Fallback
            </label>
            <textarea
              rows={5}
              value={fallbackMessage}
              onChange={(e) => setFallbackMessage(e.target.value)}
              className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 resize-none font-sans"
            />
          </div>

          <button
            onClick={handleSaveFallback}
            disabled={savingFallback}
            className="px-5 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
          >
            {savingFallback ? 'Menyimpan...' : 'Simpan Konfigurasi Fallback'}
          </button>
        </div>
      )}
    </div>
  );
};
