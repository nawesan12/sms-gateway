import type { SendArgs, SendResult } from './textbee.types.js';

export interface SmsProvider {
  sendSMS(args: SendArgs): Promise<SendResult>;
  healthCheck(args: { textbeeDeviceId: string; apiKey: string }): Promise<boolean>;
  getDeviceStatus(args: {
    textbeeDeviceId: string;
    apiKey: string;
  }): Promise<{ online: boolean; batteryLevel?: number | null }>;
}
