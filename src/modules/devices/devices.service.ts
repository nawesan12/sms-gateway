import { DeviceStatus, type Device, type PrismaClient } from '@prisma/client';
import type { AppLogger } from '@/lib/logger-types.js';
import { DeviceCrypto } from './crypto.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES, AUDIT_EVENTS } from '@/config/constants.js';
import { AuditService } from '@/modules/audit/audit.service.js';

export interface CreateDeviceInput {
  name: string;
  textbeeDeviceId: string;
  apiKey: string;
  priority?: number;
}

export interface UpdateDeviceInput {
  name?: string;
  priority?: number;
  status?: DeviceStatus;
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
  createdAt: Date;
  updatedAt: Date;
}

export class DevicesService {
  private readonly audit: AuditService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: DeviceCrypto,
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

  async create(input: CreateDeviceInput, actorId: string, correlationId: string): Promise<PublicDevice> {
    const exists = await this.prisma.device.findUnique({
      where: { textbeeDeviceId: input.textbeeDeviceId },
    });
    if (exists) {
      throw new AppError(ERROR_CODES.VALIDATION, 'textbeeDeviceId already registered', 409);
    }
    const apiKeyEncrypted = this.crypto.encrypt(input.apiKey);
    const device = await this.prisma.device.create({
      data: {
        name: input.name,
        textbeeDeviceId: input.textbeeDeviceId,
        apiKeyEncrypted,
        priority: input.priority ?? 100,
      },
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
    return this.toPublic(device);
  }

  async update(id: string, input: UpdateDeviceInput, actorId: string, correlationId: string): Promise<PublicDevice> {
    const device = await this.getById(id);
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
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

  decryptApiKey(device: Device): string {
    return this.crypto.decrypt(device.apiKeyEncrypted);
  }

  async listEligibleForHealthCheck(): Promise<Device[]> {
    return this.prisma.device.findMany({
      where: { status: { in: [DeviceStatus.ACTIVE, DeviceStatus.OFFLINE] } },
    });
  }

  async updateHeartbeat(id: string, online: boolean, batteryLevel: number | null): Promise<void> {
    await this.prisma.device.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        batteryLevel,
        status: online ? DeviceStatus.ACTIVE : DeviceStatus.OFFLINE,
      },
    });
  }
}
