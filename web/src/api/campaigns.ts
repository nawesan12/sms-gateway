import { apiFetch } from './client';
import type { CampaignDelivery, CampaignDetail, CampaignSummary, Paginated } from './types';

export const campaignsApi = {
  list: (params: { status?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return apiFetch<Paginated<CampaignSummary>>(`/v1/campaigns${qs ? `?${qs}` : ''}`);
  },
  create: (input: {
    name: string;
    messageTemplate: string;
    listId: string;
    tpsLimit?: number;
    messagesPerHour?: number;
  }) =>
    apiFetch<CampaignSummary>('/v1/campaigns', { method: 'POST', body: JSON.stringify(input) }),
  getById: (id: string) => apiFetch<CampaignDetail>(`/v1/campaigns/${id}`),
  update: (
    id: string,
    input: { name?: string; messageTemplate?: string; messagesPerHour?: number },
  ) =>
    apiFetch<CampaignSummary>(`/v1/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deliveries: (id: string, params: { page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return apiFetch<Paginated<CampaignDelivery>>(
      `/v1/campaigns/${id}/deliveries${qs ? `?${qs}` : ''}`,
    );
  },
  launch: (id: string) =>
    apiFetch<{ id: string; queued: number }>(`/v1/campaigns/${id}/launch`, {
      method: 'POST',
      body: '{}',
    }),
  cancel: (id: string) =>
    apiFetch<{ canceled: boolean }>(`/v1/campaigns/${id}/cancel`, {
      method: 'POST',
      body: '{}',
    }),
};
