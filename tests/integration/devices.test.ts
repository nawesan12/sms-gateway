import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '@/../tests/helpers/test-app.js';
import { disconnectTestPrisma, getTestPrisma, truncateAll } from '@/../tests/helpers/test-db.js';

let app: FastifyInstance;
const BOOTSTRAP = process.env.ADMIN_BOOTSTRAP_TOKEN!;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
  await disconnectTestPrisma();
});
beforeEach(async () => {
  await truncateAll(getTestPrisma());
});

describe('Devices CRUD (admin)', () => {
  it('rechaza sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/devices' });
    expect(res.statusCode).toBe(401);
  });

  it('crea con bootstrap token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/devices',
      headers: { 'x-bootstrap-token': BOOTSTRAP },
      payload: {
        name: 'phone-1',
        textbeeDeviceId: 'tb-abc',
        apiKey: 'super-secret-key-123',
        priority: 100,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe('phone-1');
  });

  it('lista, actualiza y borra', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/v1/devices',
      headers: { 'x-bootstrap-token': BOOTSTRAP },
      payload: { name: 'p', textbeeDeviceId: 'tb-1', apiKey: 'super-secret-key' },
    });
    const id = create.json().data.id;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: { 'x-bootstrap-token': BOOTSTRAP },
    });
    expect(list.json().data.items.length).toBe(1);

    const upd = await app.inject({
      method: 'PATCH',
      url: `/v1/devices/${id}`,
      headers: { 'x-bootstrap-token': BOOTSTRAP },
      payload: { priority: 5 },
    });
    expect(upd.json().data.priority).toBe(5);

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/devices/${id}`,
      headers: { 'x-bootstrap-token': BOOTSTRAP },
    });
    expect(del.statusCode).toBe(204);
  });

  it('rechaza textbeeDeviceId duplicado', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/devices',
      headers: { 'x-bootstrap-token': BOOTSTRAP },
      payload: { name: 'a', textbeeDeviceId: 'tb-x', apiKey: 'key-aaaa-bbbb' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/devices',
      headers: { 'x-bootstrap-token': BOOTSTRAP },
      payload: { name: 'b', textbeeDeviceId: 'tb-x', apiKey: 'key-aaaa-bbbb' },
    });
    expect(res.statusCode).toBe(409);
  });
});
