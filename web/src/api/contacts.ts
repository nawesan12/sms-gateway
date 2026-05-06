import { apiFetch } from './client';
import type { Contact, ImportSummary, Paginated } from './types';

export const contactsApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return apiFetch<Paginated<Contact>>(`/v1/contacts${qs ? `?${qs}` : ''}`);
  },
  create: (input: { phone: string; name?: string; email?: string }) =>
    apiFetch<Contact>('/v1/contacts', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) => apiFetch<void>(`/v1/contacts/${id}`, { method: 'DELETE' }),
  importCsv: (csv: string) =>
    apiFetch<ImportSummary>('/v1/contacts/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
};
