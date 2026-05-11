import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '@/../tests/helpers/test-app.js';
import { disconnectTestPrisma, getTestPrisma, truncateAll } from '@/../tests/helpers/test-db.js';
import { createTestDevice } from '@/../tests/helpers/fixtures.js';

// Endpoints que la app Android entregada llama. Estos tests son los guard
// rails: cualquier cambio que rompa estos contratos rompe la app sin remedio.
// Ver docs/ANDROID_CONTRACT.md.

let app: FastifyInstance;
const VALID_API_KEY = 'test-api-key-1234567890';

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

describe('Gateway (app Android → backend)', () => {
  describe('PATCH /v1/gateway/devices/:id (registrar fcmToken)', () => {
    it('200 con x-api-key válido y persiste el token', async () => {
      const device = await createTestDevice(getTestPrisma(), {
        apiKey: VALID_API_KEY,
        fcmToken: undefined as never,
      });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: { fcmToken: 'fcm-token-from-firebase-sdk-xyz' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const after = await getTestPrisma().device.findUnique({ where: { id: device.id } });
      expect(after?.fcmToken).toBe('fcm-token-from-firebase-sdk-xyz');
    });

    it('401 sin x-api-key', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}`,
        payload: { fcmToken: 'whatever-token-string' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('401 con x-api-key inválido', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}`,
        headers: { 'x-api-key': 'totally-wrong-key' },
        payload: { fcmToken: 'whatever-token-string' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('403 cuando el apiKey corresponde a OTRO device', async () => {
      const deviceA = await createTestDevice(getTestPrisma(), {
        apiKey: VALID_API_KEY,
        textbeeDeviceId: 'tb-A',
      });
      const deviceB = await createTestDevice(getTestPrisma(), {
        apiKey: 'another-key-for-device-b-9999',
        textbeeDeviceId: 'tb-B',
      });
      void deviceA;
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${deviceB.id}`, // URL apunta a B...
        headers: { 'x-api-key': VALID_API_KEY }, // ...pero la key es de A
        payload: { fcmToken: 'whatever-token-string' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('400 si fcmToken es muy corto (< 10 chars)', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: { fcmToken: 'short' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /v1/gateway/devices/:id/heartbeat', () => {
    it('200 y actualiza lastHeartbeat + status ACTIVE', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      // Forzar status OFFLINE para confirmar que el heartbeat lo vuelve ACTIVE.
      await getTestPrisma().device.update({
        where: { id: device.id },
        data: { status: 'OFFLINE' },
      });

      const before = Date.now();
      const res = await app.inject({
        method: 'POST',
        url: `/v1/gateway/devices/${device.id}/heartbeat`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: { batteryLevel: 75 },
      });
      expect(res.statusCode).toBe(200);

      const after = await getTestPrisma().device.findUnique({ where: { id: device.id } });
      expect(after?.status).toBe('ACTIVE');
      expect(after?.batteryLevel).toBe(75);
      expect(after?.lastHeartbeat?.getTime() ?? 0).toBeGreaterThanOrEqual(before);
    });

    it('400 si batteryLevel está fuera de rango', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const res = await app.inject({
        method: 'POST',
        url: `/v1/gateway/devices/${device.id}/heartbeat`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: { batteryLevel: 150 },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /v1/gateway/devices/:id/sms-status', () => {
    it('marca SmsMessage como SENT cuando reporta status:sent', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const sms = await getTestPrisma().smsMessage.create({
        data: {
          deviceId: device.id,
          recipientE164: '+5491132111111',
          status: 'PENDING',
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}/sms-status`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: { smsId: sms.id, status: 'sent' },
      });
      expect(res.statusCode).toBe(200);

      const after = await getTestPrisma().smsMessage.findUnique({ where: { id: sms.id } });
      expect(after?.status).toBe('SENT');
      expect(after?.sentAt).not.toBeNull();
    });

    it('silenciosamente devuelve 200 cuando smsId no existe (contrato congelado)', async () => {
      // La app Android no puede reaccionar a un 404 — el SMS ya fue enviado de
      // su lado. Si el backend devolviera error, la app reintentaría infinito.
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}/sms-status`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: {
          smsId: '00000000-0000-0000-0000-000000000000',
          status: 'sent',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('400 si status no es uno de los 3 literales permitidos', async () => {
      const device = await createTestDevice(getTestPrisma(), { apiKey: VALID_API_KEY });
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/gateway/devices/${device.id}/sms-status`,
        headers: { 'x-api-key': VALID_API_KEY },
        payload: {
          smsId: '00000000-0000-0000-0000-000000000000',
          status: 'unknown-status',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
