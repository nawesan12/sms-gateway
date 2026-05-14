import { apiFetch, getToken } from './client';
import type { Contact, ImportEvent, ImportSummary, Paginated } from './types';

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
  bulkCreate: (input: { phones: string[]; defaultName?: string }) =>
    apiFetch<ImportSummary>('/v1/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  remove: (id: string) => apiFetch<void>(`/v1/contacts/${id}`, { method: 'DELETE' }),

  importCsvStream: async (
    csv: string,
    onEvent: (event: ImportEvent) => void,
    signal?: AbortSignal,
  ): Promise<ImportSummary> => {
    const token = getToken();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    };
    if (token) {
      headers['x-bootstrap-token'] = token;
      headers.authorization = `Bearer ${token}`;
    }

    const isViteDev = import.meta.env.DEV && location.port === '5173';
    const url = `${isViteDev ? '/api' : ''}/v1/contacts/import`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ csv }),
      signal,
    });

    if (!res.ok || !res.body) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) message = body.error.message;
      } catch {
        /* non-JSON */
      }
      throw new Error(message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let summary: ImportSummary | null = null;
    let errorMsg: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!frame.startsWith('data: ')) continue;
        let event: ImportEvent;
        try {
          event = JSON.parse(frame.slice(6)) as ImportEvent;
        } catch {
          continue;
        }
        onEvent(event);
        if (event.phase === 'done') summary = event.summary;
        else if (event.phase === 'error') errorMsg = event.message;
      }
    }

    if (errorMsg) throw new Error(errorMsg);
    if (!summary) throw new Error('stream ended without summary');
    return summary;
  },
};
