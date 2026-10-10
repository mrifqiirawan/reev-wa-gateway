import React, { useState } from 'react';
import {
  Terminal,
  Key,
  Webhook,
  Send,
  Copy,
  Check,
  Play,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { WebhookConfig } from '../../types/gateway';
import { apiService } from '../../services/api';

interface ApiPlaygroundViewProps {
  webhookConfig: WebhookConfig | null;
  onRefresh: () => void;
}

export const ApiPlaygroundView: React.FC<ApiPlaygroundViewProps> = ({
  webhookConfig,
  onRefresh,
}) => {
  const [apiKey] = useState('GATEWAY_API_KEY_DARI_ENV_BACKEND');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Playground Endpoint Form
  const [endpoint, setEndpoint] = useState('/api/messages/send');
  const [reqBody, setReqBody] = useState(
    JSON.stringify(
      {
        recipient: '6281298765432',
        message: 'Halo, ini uji coba pesan dari REST API REEV WA Gateway!',
        deviceId: 'device_primary',
      },
      null,
      2
    )
  );
  const [respData, setRespData] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  // Webhook Form
  const [whUrl, setWhUrl] = useState(webhookConfig?.url || 'https://webhook.site/reev-gateway-demo');
  const [whSecret, setWhSecret] = useState(webhookConfig?.secretKey || 'reev_whsec_9918274');
  const [whEvents, setWhEvents] = useState(
    webhookConfig?.events || {
      onMessageReceived: true,
      onMessageSent: true,
      onMessageDelivered: true,
      onMessageFailed: true,
      onDeviceStatusChanged: true,
    }
  );
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [whResult, setWhResult] = useState<Record<string, unknown> | null>(null);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleExecuteApi = async () => {
    setExecuting(true);
    setRespData(null);
    try {
      const parsed = JSON.parse(reqBody);
      const res = await fetch(endpoint, {
        credentials: 'same-origin',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setRespData(JSON.stringify(data, null, 2));
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error executing request';
      setRespData(JSON.stringify({ success: false, error: msg }, null, 2));
    } finally {
      setExecuting(false);
    }
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      const res = await apiService.testWebhook({
        event: 'message.received',
        testNumber: '6281234567890',
      });
      setWhResult(res);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Webhook error';
      setWhResult({ success: false, error: msg });
    } finally {
      setTestingWebhook(false);
    }
  };

  const sampleCurl = `curl -X POST https://your-domain.com/api/messages/send \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '${reqBody.replace(/\n/g, '').replace(/\s+/g, ' ')}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-sky-400" />
          API Playground & Integrasi Webhook
        </h2>
        <p className="text-xs text-slate-400">
          Uji coba interaktif REST API gateway dan sinkronisasi dua arah ke server backend via webhook HTTP.
        </p>
      </div>

      {/* API Key Management Box */}
      <div className="p-5 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-sky-400" />
            Live Secret API Key
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
            PRODUKSI AKTIF
          </span>
        </div>

        <div className="p-3 bg-[#020618] border border-slate-800 rounded-lg flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-sky-300 truncate">{apiKey}</span>
          <button
            onClick={handleCopyKey}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-mono transition-colors shrink-0"
          >
            {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedKey ? 'Disalin' : 'Salin Key'}
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Sertakan header <code className="text-sky-400 font-mono">Authorization: Bearer &lt;API_KEY&gt;</code> pada setiap request ke endpoint gateway.
        </p>
      </div>

      {/* Two Column Grid: REST API Playground & Webhook Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: REST API Console */}
        <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              REST API Request Console
            </h3>
            <button
              onClick={handleCopyCurl}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1"
            >
              {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Salin cURL
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Target Endpoint
            </label>
            <select
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value);
                if (e.target.value === '/api/messages/send-otp') {
                  setReqBody(
                    JSON.stringify(
                      {
                        recipient: '6281298765432',
                        otpCode: '918204',
                        serviceName: 'REEV App',
                        expiresInMinutes: 5,
                      },
                      null,
                      2
                    )
                  );
                } else {
                  setReqBody(
                    JSON.stringify(
                      {
                        recipient: '6281298765432',
                        message: 'Halo dari REEV Gateway!',
                        deviceId: 'device_primary',
                      },
                      null,
                      2
                    )
                  );
                }
              }}
              className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            >
              <option value="/api/messages/send">POST /api/messages/send (Pesan Teks / Notifikasi)</option>
              <option value="/api/messages/send-otp">POST /api/messages/send-otp (Kode OTP Prioritas)</option>
              <option value="/api/auto-responder/simulate">POST /api/auto-responder/simulate (Simulasi Inbound)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              JSON Request Payload
            </label>
            <textarea
              rows={6}
              value={reqBody}
              onChange={(e) => setReqBody(e.target.value)}
              className="w-full bg-[#020618] border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleExecuteApi}
              disabled={executing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              {executing ? 'Mengirim Request...' : 'Kirim Eksekusi API'}
            </button>
          </div>

          {/* Response Box */}
          {respData && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-mono text-slate-400 block">HTTP 200 Response:</span>
              <pre className="p-3 bg-[#020618] border border-slate-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto">
                {respData}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Webhook Forwarder Configuration */}
        <div className="p-6 rounded-xl bg-[#0b1229] border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-indigo-400" />
              Webhook Real-Time Dispatcher
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              HMAC SHA-256
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              URL Endpoint Webhook Backend Anda
            </label>
            <input
              type="url"
              value={whUrl}
              onChange={(e) => setWhUrl(e.target.value)}
              placeholder="https://api.domainanda.com/webhook/whatsapp"
              className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Webhook HMAC Signature Secret
            </label>
            <input
              type="text"
              value={whSecret}
              onChange={(e) => setWhSecret(e.target.value)}
              className="w-full bg-[#020618] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Event Triggers */}
          <div className="space-y-2 pt-1">
            <span className="text-xs font-semibold text-slate-300 block">
              Event Trigger yang Diteruskan:
            </span>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whEvents.onMessageReceived}
                  onChange={(e) => setWhEvents({ ...whEvents, onMessageReceived: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <span>message.received (Pesan masuk dari pelanggan ke bot)</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whEvents.onMessageDelivered}
                  onChange={(e) => setWhEvents({ ...whEvents, onMessageDelivered: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <span>message.delivered (Konfirmasi pesan telah sampai di HP penerima)</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={whEvents.onMessageFailed}
                  onChange={(e) => setWhEvents({ ...whEvents, onMessageFailed: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-sky-500"
                />
                <span>message.failed (Pemberitahuan kegagalan kirim atau nomor invalid)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {testingWebhook ? 'Mengirim Test...' : 'Test Webhook Ping'}
            </button>
          </div>

          {/* Webhook Test Result */}
          {whResult !== null && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-mono text-slate-400 block">Webhook Test Result:</span>
              <pre className="p-3 bg-[#020618] border border-slate-800 rounded-lg text-xs font-mono text-indigo-300 overflow-x-auto">
                {JSON.stringify(whResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
