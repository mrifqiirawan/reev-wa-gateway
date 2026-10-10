import React, { useState } from 'react';
import {
  Inbox,
  Search,
  RefreshCw,
  MessageSquare,
  Bot,
  User,
  Clock,
  Sparkles
} from 'lucide-react';
import { InboxMessage } from '../../types/gateway';

interface InboxViewProps {
  inbox: InboxMessage[];
  onRefresh: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({ inbox, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = inbox.filter((item) => {
    const matchesSearch =
      item.senderNumber.includes(search) ||
      item.senderName.toLowerCase().includes(search.toLowerCase()) ||
      item.messageText.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === 'all' || item.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-sky-400" />
            Pesan Masuk (Real-time Inbound Feed)
          </h2>
          <p className="text-xs text-slate-400">
            Seluruh pesan WhatsApp yang masuk ke nomor terhubung terekam di sini beserta respon otomatis yang dikirimkan.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white bg-[#0b1229] border border-slate-800 rounded-lg transition-colors"
            title="Muat ulang pesan masuk"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0b1229] border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nomor, nama atau kata..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#020618] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-500 font-sans"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <span className="text-slate-500 font-mono text-[11px]">Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#020618] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            <option value="all">Semua Percakapan ({inbox.length})</option>
            <option value="replied">Terjawab Aturan Kata Kunci</option>
            <option value="fallback_replied">Terjawab Pesan Fallback</option>
            <option value="forwarded_webhook">Forwarded Webhook</option>
          </select>
        </div>
      </div>

      {/* Messages Feed Table / Cards */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 hover:border-slate-700 transition-colors space-y-3"
            >
              {/* Header: Sender info + Timestamp */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                    <User className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {item.senderName}
                      <span className="font-mono text-xs text-slate-400 font-normal">
                        (+{item.senderNumber})
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      item.status === 'replied'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : item.status === 'fallback_replied'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(item.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}{' '}
                    WIB
                  </div>
                </div>
              </div>

              {/* Chat Thread Dialog */}
              <div className="space-y-2 pt-1">
                {/* Incoming User Message */}
                <div className="p-3 bg-[#020618] border border-slate-800/80 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-sky-400">Pesan Pengirim:</span>
                    {item.matchedKeyword && (
                      <span className="font-mono text-[10px] bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-slate-300">
                        Kata Kunci Cocok: "{item.matchedKeyword}"
                      </span>
                    )}
                  </div>
                  <p className="text-slate-200 font-sans">{item.messageText}</p>
                </div>

                {/* Bot Auto-Reply */}
                {item.botReplyText && (
                  <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-lg text-xs space-y-1">
                    <div className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold">
                      <Bot className="w-3.5 h-3.5" />
                      Balasan Otomatis Bot REEV:
                    </div>
                    <p className="text-indigo-200/90 whitespace-pre-wrap font-sans leading-relaxed">
                      {item.botReplyText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-12 rounded-xl bg-[#0b1229] border border-slate-800 text-center text-slate-500 text-xs">
            Tidak ada pesan masuk yang sesuai dengan filter pencarian.
          </div>
        )}
      </div>
    </div>
  );
};
