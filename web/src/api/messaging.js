import { apiFetch } from './client';
export const messagingApi = {
    send: (input) => apiFetch('/v1/sms/send', {
        method: 'POST',
        body: JSON.stringify(input),
    }),
    status: (id) => apiFetch(`/v1/sms/${id}`),
};
