export type DeviceStatus = 'connected' | 'connecting' | 'disconnected' | 'qr_ready' | 'auth_failure';

export interface DeviceSession {
  id: string;
  name: string;
  phone: string;
  status: DeviceStatus;
  batteryLevel?: number;
  qrCode?: string;
  pairingCode?: string;
  lastConnected?: string;
  uptimeSeconds: number;
  platform: string;
  isDefault: boolean;
}

export type MessageStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'media' | 'otp' | 'broadcast' | 'auto_reply';

export interface MessageLog {
  id: string;
  recipient: string;
  recipientName?: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  timestamp: string;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  deviceId: string;
}

export interface InboxMessage {
  id: string;
  senderNumber: string;
  senderName: string;
  messageText: string;
  timestamp: string;
  matchedRuleId?: string;
  matchedKeyword?: string;
  botReplyText?: string;
  status: 'replied' | 'fallback_replied' | 'forwarded_webhook' | 'ignored';
  deviceId: string;
}

export type MatchType = 'exact' | 'contains' | 'regex' | 'starts_with';

export interface AutoResponderRule {
  id: string;
  title: string;
  matchType: MatchType;
  keywords: string[];
  replyMessage: string;
  isEnabled: boolean;
  priority: number;
  triggerCount: number;
  lastTriggered?: string;
  actionType: 'reply_text' | 'reply_menu' | 'forward_webhook';
  webhookUrl?: string;
}

export interface BulkContact {
  id: string;
  phone: string;
  name: string;
  params: Record<string, string>;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export interface BulkCampaign {
  id: string;
  name: string;
  messageTemplate: string;
  contacts: BulkContact[];
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  minDelaySeconds: number;
  maxDelaySeconds: number;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface WebhookConfig {
  url: string;
  secretKey: string;
  isEnabled: boolean;
  events: {
    onMessageReceived: boolean;
    onMessageSent: boolean;
    onMessageDelivered: boolean;
    onMessageFailed: boolean;
    onDeviceStatusChanged: boolean;
  };
  retryAttempts: number;
  lastPayload?: string;
  lastResponseCode?: number;
  lastTestedAt?: string;
}

export interface HourlyStat {
  hour: string;
  sent: number;
  delivered: number;
  failed: number;
  inbound: number;
}

export interface AnalyticsSummary {
  totalSentToday: number;
  totalDeliveredToday: number;
  totalFailedToday: number;
  totalInboundToday: number;
  successRate: number;
  avgLatencyMs: number;
  breakdown: {
    otp: number;
    transactional: number;
    promotional: number;
    chatbot: number;
  };
  hourlyData: HourlyStat[];
}
