import { buildApp } from '@/app.js';
import type { FastifyInstance } from 'fastify';

export async function createTestApp(): Promise<FastifyInstance> {
  return buildApp();
}
