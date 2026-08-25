import { apiFetch } from './client';
import type { Device } from './types';

export const devicesApi = {
  list: () => apiFetch<{ items: Device[]; total: number }>('/v1/devices'),
  create: (input: { name: string; textbeeDeviceId: string; apiKey: string; priority?: number }) =>
    apiFetch<Device>('/v1/devices', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: { name?: string; priority?: number; status?: string }) =>
    apiFetch<Device>(`/v1/devices/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/v1/devices/${id}`, { method: 'DELETE' }),
  markSuspected: (id: string, reason?: string) =>
    apiFetch<Device>(`/v1/devices/${id}/suspect`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason ?? 'manual_mark' }),
    }),
  clearSuspected: (id: string) =>
    apiFetch<Device>(`/v1/devices/${id}/suspect`, { method: 'DELETE' }),
};
