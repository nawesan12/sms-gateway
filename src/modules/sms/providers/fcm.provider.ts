import type { Messaging } from 'firebase-admin/messaging';
import type { AppLogger } from '@/lib/logger-types.js';
import type { SmsProvider } from './sms-provider.interface.js';
import type { SendArgs, SendResult } from './provider.types.js';

// Provider que dispara un push FCM al fcmToken del device, llevando un payload
// data-only que la app Android parsea y traduce a SmsManager.sendTextMessage().
//
// La respuesta de FCM solo confirma que Firebase aceptó el push, no que el
// celular efectivamente envió el SMS — eso se reporta despues via
// PATCH /v1/gateway/devices/:id/sms-status (handler en gateway.service.ts).
export class FcmProvider implements SmsProvider {
  constructor(
    private readonly fcm: Messaging | null,
    private readonly logger: AppLogger,
  ) {}

  async sendSMS(args: SendArgs): Promise<SendResult> {
    const start = Date.now();

    if (!this.fcm) {
      return {
        ok: false,
        errorCode: 'NO_FCM_CONFIG',
        errorMessage: 'FIREBASE_SERVICE_ACCOUNT_JSON not set',
        latencyMs: Date.now() - start,
      };
    }

    const token = args.device.fcmToken;
    if (!token) {
      return {
        ok: false,
        errorCode: 'NO_FCM_TOKEN',
        errorMessage: `device ${args.device.id} has no fcmToken (app not registered)`,
        latencyMs: Date.now() - start,
      };
    }

    try {
      // La app Android espera el payload JSON-stringified dentro de data.smsData
      // (ver FCMService.java línea 52). Si mandamos campos sueltos los ignora.
      const smsData = JSON.stringify({
        recipients: args.recipients,
        message: args.message,
        smsId: args.smsMessageId,
        smsBatchId: args.smsMessageId,
      });
      const messageId = await this.fcm.send({
        token,
        data: { smsData },
        android: {
          priority: 'high',
          // sin TTL: si el celular está apagado mucho rato, queremos que el
          // SMS se entregue cuando vuelva en línea (FCM lo retiene 4 semanas
          // por default).
        },
      });
      return {
        ok: true,
        providerMessageId: messageId,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const code = (err as { code?: string }).code ?? 'FCM_ERROR';
      const message = err instanceof Error ? err.message : 'fcm send failed';
      this.logger.warn({ deviceId: args.device.id, code, message, latencyMs }, 'fcm send failed');
      return {
        ok: false,
        errorCode: code,
        errorMessage: message,
        latencyMs,
      };
    }
  }
}
