import {
  DeviceSession,
  MessageLog,
  InboxMessage,
  AutoResponderRule,
  WebhookConfig,
  AnalyticsSummary
} from '../types/gateway';

class ApiService {
  constructor() {
    // Remove obsolete plaintext credentials and unverified browser tokens.
    localStorage.removeItem('reev_admin_creds');
    localStorage.removeItem('reev_auth_token');
  }
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ?? (!['GET', 'HEAD'].includes(method) ? '{}' : undefined);
    const res = await fetch(endpoint, {
      ...options,
      method,
      body,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: options.signal || AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({ error: 'Respons backend bukan JSON. Periksa konfigurasi deployment.' }));
    if (!res.ok) {
      if (res.status === 401 && endpoint !== '/api/auth/login') window.dispatchEvent(new Event('reev-session-expired'));
      const error = new Error(data.error || `HTTP ${res.status}`) as Error & { status: number };
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async login(username: string, password: string): Promise<{ success: boolean; user: { username: string; role: string } }> {
    const result = await this.request<{ success: boolean; user: { username: string; role: string } }>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    });
    localStorage.removeItem('reev_auth_token');
    localStorage.removeItem('reev_admin_creds');
    return result;
  }
  async verifyAuth(): Promise<{ success: boolean; user: { username: string; role: string } }> {
    return this.request('/api/auth/verify');
  }
  async changeCredentials(params: { currentPassword: string; newUsername?: string; newPassword?: string }): Promise<{ success: boolean; message: string; username: string }> {
    return this.request('/api/auth/change-credentials', { method: 'POST', body: JSON.stringify(params) });
  }
  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST', body: '{}' });
  }

  // System Status
  async getStatus() {
    return this.request<{
      success: boolean;
      app: string;
      version: string;
      engine: string;
      uptime: number;
      activeDevices: number;
    }>('/api/status');
  }

  // Devices
  async getDevices(): Promise<{ success: boolean; devices: DeviceSession[] }> {
    return this.request('/api/devices');
  }

  async createDevice(name: string, phone?: string): Promise<{ success: boolean; device: DeviceSession }> {
    return this.request('/api/devices/create', {
      method: 'POST',
      body: JSON.stringify({ name, phone }),
    });
  }

  async initBaileys(): Promise<{ success: boolean; device: DeviceSession }> {
    return this.request('/api/devices/init-baileys', {
      method: 'POST',
    });
  }

  async reconnectDevice(id: string): Promise<{ success: boolean; device: DeviceSession }> {
    return this.request(`/api/devices/${id}/reconnect`, {
      method: 'POST',
    });
  }

  async deleteDevice(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/devices/${id}`, {
      method: 'DELETE',
    });
  }

  // Outbound Messages
  async sendMessage(params: {
    recipient: string;
    message: string;
    deviceId?: string;
    type?: string;
  }): Promise<{ success: boolean; messageId: string; status: string; latencyMs: number }> {
    return this.request('/api/messages/send', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async sendOtp(params: {
    recipient: string;
    otpCode: string;
    serviceName?: string;
    expiresInMinutes?: number;
  }): Promise<{ success: boolean; messageId: string; status: string; latencyMs: number }> {
    return this.request('/api/messages/send-otp', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async sendBulk(params: {
    campaignName: string;
    template: string;
    contacts: Array<{ phone: string; name?: string; params?: Record<string, string> }>;
    minDelay?: number;
    maxDelay?: number;
  }): Promise<{ success: boolean; campaignId: string; totalContacts: number; queuedCount: number }> {
    return this.request('/api/messages/bulk', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Auto-Responder & Rules
  async getAutoResponderRules(): Promise<{
    success: boolean;
    rules: AutoResponderRule[];
    fallback: { isEnabled: boolean; replyMessage: string; delayMs: number };
  }> {
    return this.request('/api/auto-responder/rules');
  }

  async createAutoResponderRule(rule: Partial<AutoResponderRule>): Promise<{
    success: boolean;
    rule: AutoResponderRule;
  }> {
    return this.request('/api/auto-responder/rules', {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async updateAutoResponderRule(id: string, updates: Partial<AutoResponderRule>): Promise<{
    success: boolean;
    rule: AutoResponderRule;
  }> {
    return this.request(`/api/auto-responder/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteAutoResponderRule(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/auto-responder/rules/${id}`, {
      method: 'DELETE',
    });
  }

  async updateFallbackConfig(config: { isEnabled: boolean; replyMessage: string; delayMs?: number }): Promise<{
    success: boolean;
    fallback: { isEnabled: boolean; replyMessage: string; delayMs: number };
  }> {
    return this.request('/api/auto-responder/fallback', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async simulateInboundMessage(params: {
    incomingMessage: string;
    senderNumber?: string;
    senderName?: string;
  }): Promise<{
    success: boolean;
    matched: boolean;
    matchedRuleId?: string;
    matchedKeyword?: string;
    status: string;
    replyText: string | null;
    inboxItem?: InboxMessage;
  }> {
    return this.request('/api/auto-responder/simulate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // Inbox & Logs
  async getInbox(): Promise<{ success: boolean; inbox: InboxMessage[] }> {
    return this.request('/api/inbox');
  }

  async getLogs(params: { status?: string; type?: string; limit?: number } = {}): Promise<{
    success: boolean;
    total: number;
    logs: MessageLog[];
  }> {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.type) query.append('type', params.type);
    if (params.limit) query.append('limit', String(params.limit));
    return this.request(`/api/logs?${query.toString()}`);
  }

  async deleteLogs(ids: string[]): Promise<{ success: boolean; deleted: number }> {
    return this.request('/api/logs', { method: 'DELETE', body: JSON.stringify({ ids }) });
  }
  async checkRecipient(recipient: string): Promise<{ success: boolean; exists: boolean; jid: string }> {
    return this.request('/api/recipients/check', { method: 'POST', body: JSON.stringify({ recipient }) });
  }
  async retryLog(id: string): Promise<{ success: boolean; log: MessageLog }> {
    return this.request('/api/logs/retry', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  }

  // Analytics
  async getAnalytics(): Promise<{ success: boolean } & AnalyticsSummary> {
    return this.request('/api/analytics');
  }

  // Webhook
  async getWebhookConfig(): Promise<{ success: boolean; webhook: WebhookConfig }> {
    return this.request('/api/webhook/config');
  }

  async updateWebhookConfig(config: Partial<WebhookConfig>): Promise<{ success: boolean; webhook: WebhookConfig }> {
    return this.request('/api/webhook/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async testWebhook(params: { event?: string; testNumber?: string } = {}): Promise<{
    success: boolean;
    message: string;
    statusCode: number;
    payload: unknown;
  }> {
    return this.request('/api/webhook/test', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }
}

export const apiService = new ApiService();
