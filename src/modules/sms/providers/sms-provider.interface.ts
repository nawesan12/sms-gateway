import type { SendArgs, SendResult } from './provider.types.js';

export interface SmsProvider {
  sendSMS(args: SendArgs): Promise<SendResult>;
}
