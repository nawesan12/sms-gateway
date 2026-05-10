import * as crypto from 'node:crypto';
import { DeviceStatus, type Device, type PrismaClient } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES, AUDIT_EVENTS } from '@/config/constants.js';
import { AuditService } from '@/modules/audit/audit.service.js';
import { generateApiKey, hashApiKey } from '@/lib/api-key.js';

export interface CreateDeviceInput {
  name: string;
  priority?: number;
}

export interface CreateDeviceResult {
  device: PublicDevice;
  // Plaintext apiKey — visible una sola vez. Hay que pegarla en la app
  // Android antes de salir de esta response.
  apiKey: string;
}

export interface UpdateDeviceInput {
  name?: string;
  priority?: number;
  status?: DeviceStatus;
  minDelayBetweenMs?: number;
}

export interface PublicDevice {
  id: string;
  name: string;
  textbeeDeviceId: string;
  priority: number;
  status: DeviceStatus;
  batteryLevel: number | null;
  lastHeartbeat: Date | null;
  failureCount: number;
  circuitState: string;
  minDelayBetweenMs: number;
  hasFcmToken: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class DevicesService {
  private readonly audit: AuditService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly masterKeyB64: string,
    logger: AppLogger,
  ) {
    this.audit = new AuditService(prisma, logger);
  }

  toPublic(device: Device): PublicDevice {
    return {
      id: device.id,
      name: device.name,
      textbeeDeviceId: device.textbeeDeviceId,
      priority: device.priority,
      status: device.status,
      batteryLevel: device.batteryLevel,
      lastHeartbeat: device.lastHeartbeat,
      failureCount: device.failureCount,
      circuitState: device.circuitState,
      minDelayBetweenMs: device.minDelayBetweenMs,
      hasFcmToken: device.fcmToken !== null,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  async list(): Promise<PublicDevice[]> {
    const devices = await this.prisma.device.findMany({ orderBy: { priority: 'asc' } });
    return devices.map((d) => this.toPublic(d));
  }

  async getById(id: string): Promise<Device> {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Device ${id} not found`, 404);
    }
    return device;
  }

  async create(
    input: CreateDeviceInput,
    actorId: string,
    correlationId: string,
  ): Promise<CreateDeviceResult> {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(this.masterKeyB64, apiKey);

    const device = await this.prisma.device.create({
      data: {
        name: input.name,
        // textbeeDeviceId queda igual a id por compat con código que filtra
        // por ese campo. Como id es UUID generado por Prisma default, lo
        // copiamos en un update inmediato.
        textbeeDeviceId: crypto.randomUUID(),
        apiKeyHash,
        priority: input.priority ?? 100,
      },
    });
    await this.prisma.device.update({
      where: { id: device.id },
      data: { textbeeDeviceId: device.id },
    });

    await this.audit.record({
      eventType: AUDIT_EVENTS.DEVICE_CREATED,
      actorType: 'admin',
      actorId,
      targetType: 'device',
      targetId: device.id,
      metadata: { name: device.name, priority: device.priority },
      correlationId,
    });
    return {
      device: this.toPublic({ ...device, textbeeDeviceId: device.id }),
      apiKey,
    };
  }

  // Lookup de device por la apiKey en plaintext que la app Android manda
  // en el header x-api-key. Devuelve null si no matchea.
  async findByApiKey(apiKey: string): Promise<Device | null> {
    const apiKeyHash = hashApiKey(this.masterKeyB64, apiKey);
    return this.prisma.device.findUnique({ where: { apiKeyHash } });
  }

  async update(
    id: string,
    input: UpdateDeviceInput,
    actorId: string,
    correlationId: string,
  ): Promise<PublicDevice> {
    const device = await this.getById(id);
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.minDelayBetweenMs !== undefined
          ? { minDelayBetweenMs: input.minDelayBetweenMs }
          : {}),
      },
    });
    await this.audit.record({
      eventType: AUDIT_EVENTS.DEVICE_UPDATED,
      actorType: 'admin',
      actorId,
      targetType: 'device',
      targetId: id,
      metadata: input as Record<string, unknown>,
      correlationId,
    });
    return this.toPublic(updated);
  }

  async remove(id: string, actorId: string, correlationId: string): Promise<void> {
    const device = await this.getById(id);
    await this.prisma.device.delete({ where: { id: device.id } });
    await this.audit.record({
      eventType: AUDIT_EVENTS.DEVICE_DELETED,
      actorType: 'admin',
      actorId,
      targetType: 'device',
      targetId: id,
      correlationId,
    });
  }

  async updateHeartbeat(id: string, batteryLevel: number | null): Promise<void> {
    await this.prisma.device.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        batteryLevel,
        status: DeviceStatus.ACTIVE,
      },
    });
  }

  async updateFcmToken(id: string, fcmToken: string): Promise<void> {
    await this.prisma.device.update({
      where: { id },
      data: { fcmToken, lastHeartbeat: new Date(), status: DeviceStatus.ACTIVE },
    });
  }
}
