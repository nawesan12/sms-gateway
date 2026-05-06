import { apiFetch } from './client';
export const contactsApi = {
    list: (params = {}) => {
        const q = new URLSearchParams();
        if (params.search)
            q.set('search', params.search);
        if (params.page)
            q.set('page', String(params.page));
        if (params.pageSize)
            q.set('pageSize', String(params.pageSize));
        const qs = q.toString();
        return apiFetch(`/v1/contacts${qs ? `?${qs}` : ''}`);
    },
    create: (input) => apiFetch('/v1/contacts', { method: 'POST', body: JSON.stringify(input) }),
    remove: (id) => apiFetch(`/v1/contacts/${id}`, { method: 'DELETE' }),
    importCsv: (csv) => apiFetch('/v1/contacts/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
    }),
};
