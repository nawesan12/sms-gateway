import { apiFetch } from './client';
import type { AdminStats } from './types';

export const statsApi = {
  get: () => apiFetch<AdminStats>('/v1/admin/stats'),
};
