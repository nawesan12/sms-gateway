import { apiFetch } from './client';
import type { Contact, ContactList, Paginated } from './types';

export const listsApi = {
  list: () => apiFetch<{ items: ContactList[]; total: number }>('/v1/contact-lists'),
  create: (input: { name: string; description?: string }) =>
    apiFetch<ContactList>('/v1/contact-lists', { method: 'POST', body: JSON.stringify(input) }),
  getById: (id: string) => apiFetch<ContactList>(`/v1/contact-lists/${id}`),
  update: (id: string, input: { name?: string; description?: string }) =>
    apiFetch<ContactList>(`/v1/contact-lists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  remove: (id: string) => apiFetch<void>(`/v1/contact-lists/${id}`, { method: 'DELETE' }),
  members: (id: string, params: { page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return apiFetch<Paginated<Contact>>(`/v1/contact-lists/${id}/members${qs ? `?${qs}` : ''}`);
  },
  addMembers: (id: string, contactIds: string[]) =>
    apiFetch<{ added: number }>(`/v1/contact-lists/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ contactIds }),
    }),
  bulkAddFromSearch: (
    id: string,
    input: {
      search?: string;
      limit: number;
      dryRun?: boolean;
      onlyWithoutList?: boolean;
    },
  ) =>
    apiFetch<{ added: number; matched: number; requested: number; dryRun: boolean }>(
      `/v1/contact-lists/${id}/members/bulk`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  removeMember: (id: string, contactId: string) =>
    apiFetch<void>(`/v1/contact-lists/${id}/members/${contactId}`, { method: 'DELETE' }),
};
