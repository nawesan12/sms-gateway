import { CampaignStatus, DeliveryStatus, type PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
import { listTemplateVariables } from '@/lib/template.js';

export interface CreateCampaignInput {
  name: string;
  messageTemplate: string;
  listId: string;
  tpsLimit?: number;
}

export interface CampaignSendJob {
  deliveryId: string;
  campaignId: string;
  correlationId: string;
}

export class CampaignsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly env: AppEnv,
    private readonly logger: AppLogger,
    private readonly campaignQueue: Queue<CampaignSendJob>,
  ) {}

  async create(input: CreateCampaignInput, correlationId: string) {
    if (input.messageTemplate.length === 0 || input.messageTemplate.length > 1600) {
      throw new AppError(ERROR_CODES.VALIDATION, 'message must be 1..1600 chars', 400);
    }
    const list = await this.prisma.contactList.findUnique({
      where: { id: input.listId },
      include: { _count: { select: { members: true } } },
    });
    if (!list) throw new AppError(ERROR_CODES.NOT_FOUND, 'List not found', 404);

    const allowedVars = ['name', 'phone'];
    const used = listTemplateVariables(input.messageTemplate);
    const unknown = used.filter((v) => !allowedVars.includes(v));
    if (unknown.length > 0) {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        `Unknown template variables: ${unknown.join(', ')}. Allowed: ${allowedVars.join(', ')}`,
        400,
      );
    }

    const campaign = await this.prisma.campaign.create({
      data: {
        name: input.name,
        messageTemplate: input.messageTemplate,
        listId: input.listId,
        tpsLimit: input.tpsLimit ?? 1,
        totalRecipients: list._count.members,
      },
    });
    this.logger.info({ campaignId: campaign.id, correlationId }, 'campaign created');
    return campaign;
  }

  async list(args: { status?: CampaignStatus; page: number; pageSize: number }) {
    const where = args.status ? { status: args.status } : {};
    const skip = (args.page - 1) * args.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: args.pageSize,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return { items, total, page: args.page, pageSize: args.pageSize };
  }

  async getById(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new AppError(ERROR_CODES.NOT_FOUND, 'Campaign not found', 404);
    const counts = await this.prisma.campaignDelivery.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { _all: true },
    });
    const summary: Record<string, number> = { PENDING: 0, SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const c of counts) summary[c.status] = c._count._all;
    return {
      ...campaign,
      deliveriesByStatus: summary,
    };
  }

  async listDeliveries(id: string, args: { page: number; pageSize: number }) {
    await this.assertExists(id);
    const skip = (args.page - 1) * args.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.campaignDelivery.findMany({
        where: { campaignId: id },
        include: { contact: { select: { id: true, phoneE164: true, name: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: args.pageSize,
      }),
      this.prisma.campaignDelivery.count({ where: { campaignId: id } }),
    ]);
    return { items, total, page: args.page, pageSize: args.pageSize };
  }

  async launch(id: string, correlationId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { list: { include: { members: true } } },
    });
    if (!campaign) throw new AppError(ERROR_CODES.NOT_FOUND, 'Campaign not found', 404);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new AppError(
        ERROR_CODES.VALIDATION,
        `Campaign cannot be launched from status ${campaign.status}`,
        409,
      );
    }
    if (campaign.list.members.length === 0) {
      throw new AppError(ERROR_CODES.VALIDATION, 'Cannot launch a campaign with empty list', 400);
    }

    // Create deliveries (one per member)
    await this.prisma.campaignDelivery.createMany({
      data: campaign.list.members.map((m) => ({
        campaignId: campaign.id,
        contactId: m.contactId,
        status: DeliveryStatus.PENDING,
      })),
      skipDuplicates: true,
    });

    const deliveries = await this.prisma.campaignDelivery.findMany({
      where: { campaignId: campaign.id, status: DeliveryStatus.PENDING },
      select: { id: true },
    });

    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.QUEUED,
        launchedAt: new Date(),
        totalRecipients: deliveries.length,
      },
    });

    // Enqueue all deliveries; rate limiting is enforced at worker level.
    const jobs = deliveries.map((d) => ({
      name: 'campaign.send',
      data: { deliveryId: d.id, campaignId: campaign.id, correlationId },
      opts: {
        attempts: this.env.WORKER_MAX_RETRIES + 1,
        backoff: { type: 'exponential' as const, delay: this.env.WORKER_BACKOFF_MS },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 24 * 3600 },
      },
    }));
    if (jobs.length > 0) {
      await this.campaignQueue.addBulk(jobs);
    }

    this.logger.info(
      { campaignId: campaign.id, count: deliveries.length, correlationId },
      'campaign launched',
    );
    return { id: campaign.id, queued: deliveries.length };
  }

  async cancel(id: string, correlationId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new AppError(ERROR_CODES.NOT_FOUND, 'Campaign not found', 404);
    if (
      campaign.status === CampaignStatus.COMPLETED ||
      campaign.status === CampaignStatus.CANCELED
    ) {
      throw new AppError(ERROR_CODES.VALIDATION, `Already ${campaign.status}`, 409);
    }
    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.CANCELED, completedAt: new Date() },
    });
    // Mark pending deliveries as SKIPPED
    await this.prisma.campaignDelivery.updateMany({
      where: { campaignId: id, status: DeliveryStatus.PENDING },
      data: { status: DeliveryStatus.SKIPPED },
    });
    this.logger.info({ campaignId: id, correlationId }, 'campaign canceled');
  }

  private async assertExists(id: string) {
    const exists = await this.prisma.campaign.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(ERROR_CODES.NOT_FOUND, 'Campaign not found', 404);
  }
}
