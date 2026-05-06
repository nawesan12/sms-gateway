import { apiFetch } from './client';
export const listsApi = {
    list: () => apiFetch('/v1/contact-lists'),
    create: (input) => apiFetch('/v1/contact-lists', { method: 'POST', body: JSON.stringify(input) }),
    getById: (id) => apiFetch(`/v1/contact-lists/${id}`),
    update: (id, input) => apiFetch(`/v1/contact-lists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    }),
    remove: (id) => apiFetch(`/v1/contact-lists/${id}`, { method: 'DELETE' }),
    members: (id, params = {}) => {
        const q = new URLSearchParams();
        if (params.page)
            q.set('page', String(params.page));
        if (params.pageSize)
            q.set('pageSize', String(params.pageSize));
        const qs = q.toString();
        return apiFetch(`/v1/contact-lists/${id}/members${qs ? `?${qs}` : ''}`);
    },
    addMembers: (id, contactIds) => apiFetch(`/v1/contact-lists/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ contactIds }),
    }),
    removeMember: (id, contactId) => apiFetch(`/v1/contact-lists/${id}/members/${contactId}`, { method: 'DELETE' }),
};
