import { apiFetch } from './client';
export const campaignsApi = {
    list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.status)
            q.set('status', params.status);
        if (params.page)
            q.set('page', String(params.page));
        if (params.pageSize)
            q.set('pageSize', String(params.pageSize));
        const qs = q.toString();
        return apiFetch(`/v1/campaigns${qs ? `?${qs}` : ''}`);
    },
    create: (input) => apiFetch('/v1/campaigns', { method: 'POST', body: JSON.stringify(input) }),
    getById: (id) => apiFetch(`/v1/campaigns/${id}`),
    deliveries: (id, params = {}) => {
        const q = new URLSearchParams();
        if (params.page)
            q.set('page', String(params.page));
        if (params.pageSize)
            q.set('pageSize', String(params.pageSize));
        const qs = q.toString();
        return apiFetch(`/v1/campaigns/${id}/deliveries${qs ? `?${qs}` : ''}`);
    },
    launch: (id) => apiFetch(`/v1/campaigns/${id}/launch`, { method: 'POST' }),
    cancel: (id) => apiFetch(`/v1/campaigns/${id}/cancel`, { method: 'POST' }),
};
