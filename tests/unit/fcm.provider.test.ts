import { describe, it, expect, vi } from 'vitest';
import { FcmProvider } from '@/modules/sms/providers/fcm.provider.js';
import type { Messaging } from 'firebase-admin/messaging';
import type { Device } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';

// Estos tests congelan la forma del payload FCM que recibe el celu. La app
// Android ya está entregada y NO se puede actualizar — si cambia el wrapper
// `data.smsData` o las claves dentro, la app deja de funcionar para siempre.
// Ver docs/ANDROID_CONTRACT.md.

const fakeDevice: Device = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'celu-test',
  textbeeDeviceId: 'tb-1',
  apiKeyHash: null,
  apiKeyEncrypted: null,
  fcmToken: 'fcm-token-abc',
  priority: 100,
  status: 'ACTIVE',
  batteryLevel: 90,
  lastHeartbeat: new Date(),
  failureCount: 0,
  circuitState: 'CLOSED',
  circuitOpenedAt: null,
  minDelayBetweenMs: 0,
  cooldownUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function silentLogger(): AppLogger {
  const noop = () => {};
  const fn = () => silentLogger() as never;
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    trace: noop,
    fatal: noop,
    child: fn,
  } as unknown as AppLogger;
}

describe('FcmProvider — Android contract', () => {
  it('envuelve el payload en data.smsData (string JSON), no campos sueltos', async () => {
    const send = vi.fn(async () => 'fcm-msg-id');
    const fakeMessaging = { send } as unknown as Messaging;
    const provider = new FcmProvider(fakeMessaging, silentLogger());

    const result = await provider.sendSMS({
      device: fakeDevice,
      smsMessageId: '11111111-1111-1111-1111-111111111111',
      recipients: ['+5491132111111'],
      message: 'hola',
    });

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const calls = send.mock.calls as unknown as Array<
      [{ token: string; data: { smsData: string }; android?: { priority?: string } }]
    >;
    const arg = calls[0]![0];

    expect(arg.token).toBe('fcm-token-abc');
    expect(arg.android?.priority).toBe('high');
    // smsData es string JSON, no objeto
    expect(typeof arg.data.smsData).toBe('string');
    // No hay campos sueltos en data
    expect(Object.keys(arg.data)).toEqual(['smsData']);

    const inner = JSON.parse(arg.data.smsData) as Record<string, unknown>;
    // Las 4 claves exactas y nada más — agregar campos rompería el contrato.
    expect(Object.keys(inner).sort()).toEqual(
      ['message', 'recipients', 'smsBatchId', 'smsId'].sort(),
    );
    expect(inner.recipients).toEqual(['+5491132111111']);
    expect(inner.message).toBe('hola');
    expect(inner.smsId).toBe('11111111-1111-1111-1111-111111111111');
    // smsBatchId es legacy: siempre igual a smsId hoy.
    expect(inner.smsBatchId).toBe(inner.smsId);
  });

  it('devuelve NO_FCM_CONFIG cuando Messaging es null (env var faltante)', async () => {
    const provider = new FcmProvider(null, silentLogger());
    const result = await provider.sendSMS({
      device: fakeDevice,
      smsMessageId: 'x',
      recipients: ['+5491132111111'],
      message: 'hi',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('NO_FCM_CONFIG');
    }
  });

  it('devuelve NO_FCM_TOKEN cuando el device no registró su token', async () => {
    const send = vi.fn();
    const provider = new FcmProvider({ send } as unknown as Messaging, silentLogger());
    const result = await provider.sendSMS({
      device: { ...fakeDevice, fcmToken: null },
      smsMessageId: 'x',
      recipients: ['+5491132111111'],
      message: 'hi',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('NO_FCM_TOKEN');
    }
    expect(send).not.toHaveBeenCalled();
  });
});
