import { apiFetch } from './client';
import type { SmsStatus } from './types';

export const messagingApi = {
  send: (input: { phone: string; message: string; contactId?: string }) =>
    apiFetch<{ smsMessageId: string; recipientE164: string; status: 'PENDING' }>('/v1/sms/send', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  status: (id: string) => apiFetch<SmsStatus>(`/v1/sms/${id}`),
};
