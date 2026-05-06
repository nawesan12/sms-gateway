import { apiFetch } from './client';
export const statsApi = {
    get: () => apiFetch('/v1/admin/stats'),
};
