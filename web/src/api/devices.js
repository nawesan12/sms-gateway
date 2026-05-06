import { apiFetch } from './client';
export const devicesApi = {
    list: () => apiFetch('/v1/devices'),
    create: (input) => apiFetch('/v1/devices', { method: 'POST', body: JSON.stringify(input) }),
    update: (id, input) => apiFetch(`/v1/devices/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    remove: (id) => apiFetch(`/v1/devices/${id}`, { method: 'DELETE' }),
};
