import type { Device } from '@prisma/client';

export interface SendArgs {
  device: Device;
  smsMessageId: string;
  recipients: string[];
  message: string;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string | undefined;
  errorCode?: string | undefined;
  errorMessage?: string | undefined;
  latencyMs: number;
}
