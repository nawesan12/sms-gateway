import { DeliveryStatus, SmsStatus, type PrismaClient } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';
import type { DevicesService } from '@/modules/devices/devices.service.js';
import type { SmsStatusBodyT } from './gateway.schemas.js';

export class GatewayService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly devices: DevicesService,
    private readonly logger: AppLogger,
  ) {}

  async registerFcmToken(deviceId: string, fcmToken: string): Promise<void> {
    await this.devices.updateFcmToken(deviceId, fcmToken);
    this.logger.info({ deviceId }, 'device registered fcmToken');
  }

  async heartbeat(deviceId: string, batteryLevel: number | null): Promise<void> {
    await this.devices.updateHeartbeat(deviceId, batteryLevel);
  }

  async reportSmsStatus(deviceId: string, payload: SmsStatusBodyT): Promise<void> {
    const sms = await this.prisma.smsMessage.findUnique({ where: { id: payload.smsId } });
    if (!sms) {
      this.logger.warn({ deviceId, smsId: payload.smsId }, 'sms-status for unknown sms');
      return;
    }
    if (sms.deviceId !== deviceId) {
      this.logger.warn(
        { deviceId, smsDeviceId: sms.deviceId, smsId: payload.smsId },
        'sms-status from wrong device',
      );
      return;
    }

    // Normalizamos a lowercase: la app Android manda "SENT"/"DELIVERED"/"FAILED"/
    // "DELIVERY_FAILED", pero internamente trabajamos en lowercase. DELIVERY_FAILED
    // (el carrier no devolvió delivery report) lo tratamos como reporte
    // informativo: no marca el SmsMessage como FAILED, solo loguea.
    const raw = String(payload.status).toLowerCase();
    const normalized: 'sent' | 'delivered' | 'failed' | 'delivery_failed' =
      raw === 'sent' ||
      raw === 'delivered' ||
      raw === 'failed' ||
      raw === 'delivery_failed'
        ? (raw as 'sent' | 'delivered' | 'failed' | 'delivery_failed')
        : 'failed';

    const now = new Date();
    if (normalized === 'sent') {
      if (sms.status === SmsStatus.PENDING || sms.status === SmsStatus.RETRYING) {
        await this.prisma.smsMessage.update({
          where: { id: sms.id },
          data: { status: SmsStatus.SENT, sentAt: sms.sentAt ?? now },
        });
      }
      return;
    }
    if (normalized === 'delivered') {
      await this.prisma.smsMessage.update({
        where: { id: sms.id },
        data: {
          status: SmsStatus.DELIVERED,
          deliveredAt: now,
          sentAt: sms.sentAt ?? now,
        },
      });
      // Si este SMS pertenece a una campaña, propagamos el DELIVERED al
      // CampaignDelivery correspondiente para que la UI lo refleje. Solo
      // promovemos desde SENT (no desde FAILED/SKIPPED) para no pisar estados
      // terminales por reportes tardíos del device.
      await this.prisma.campaignDelivery.updateMany({
        where: { smsMessageId: sms.id, status: DeliveryStatus.SENT },
        data: { status: DeliveryStatus.DELIVERED, deliveredAt: now },
      });
      return;
    }
    if (normalized === 'failed') {
      await this.prisma.smsMessage.update({
        where: { id: sms.id },
        data: {
          status: SmsStatus.FAILED,
          failedAt: now,
          errorCode: 'DEVICE_REPORTED_FAILURE',
          errorMessage: payload.errorMessage ?? null,
        },
      });
      return;
    }
    // 'delivery_failed': el carrier no devolvió delivery report. NO es un
    // failure real del envío — el SMS salió pero no podemos confirmar entrega.
    // Lo logueamos para visibilidad y no tocamos el estado del SmsMessage.
    this.logger.info(
      { deviceId, smsId: payload.smsId, errorMessage: payload.errorMessage },
      'sms delivery report missing (carrier did not confirm)',
    );
  }
}
