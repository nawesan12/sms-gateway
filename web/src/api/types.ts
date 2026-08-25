export interface Device {
  id: string;
  name: string;
  textbeeDeviceId: string;
  priority: number;
  status: 'ACTIVE' | 'INACTIVE' | 'OFFLINE';
  batteryLevel: number | null;
  lastHeartbeat: string | null;
  failureCount: number;
  circuitState: string;
  hasFcmToken?: boolean;
  suspectedBlocked?: boolean;
  suspectedBlockedAt?: string | null;
  suspectedBlockedReason?: string | null;
  routerLoadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  phoneE164: string;
  name: string | null;
  email: string | null;
  metadata: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContactList {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  messageTemplate: string;
  listId: string;
  status: 'DRAFT' | 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  tpsLimit: number;
  messagesPerHour: number;
  halfwayNotifiedAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends CampaignSummary {
  deliveriesByStatus: Record<string, number>;
  progress: number;
}

export interface CampaignDelivery {
  id: string;
  campaignId: string;
  contactId: string;
  smsMessageId: string | null;
  deviceId: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  contact: { id: string; phoneE164: string; name: string | null };
}

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  errors: { row: number; phone: string; reason: string }[];
}

export type ImportEvent =
  | { phase: 'parsing' }
  | { phase: 'validated'; total: number; valid: number; invalid: number }
  | {
      phase: 'progress';
      processed: number;
      total: number;
      imported: number;
      updated: number;
      skipped: number;
    }
  | { phase: 'done'; summary: ImportSummary }
  | { phase: 'error'; message: string };

export interface SmsStatus {
  id: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  recipientE164: string;
  textbeeMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  retryCount: number;
  createdAt: string;
}

export interface AdminStats {
  windowHours: number;
  otp: { requested: number };
  sms: { sent: number; delivered: number; failed: number; total: number };
  devices: { active: number };
  costEstimateUsd: number;
}
