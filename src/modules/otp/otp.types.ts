export interface CreateOtpInput {
  phoneE164: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateOtpResult {
  requestId: string;
  expiresInSec: number;
  cooldownSec: number;
  plainCode: string; // returned ONLY to be enqueued in worker, never persisted/logged
}

export type VerifyOtpResult =
  | { ok: true; userId: string; phoneE164: string }
  | { ok: false; reason: 'INVALID' | 'EXPIRED' | 'MAX_ATTEMPTS' | 'USED' };
