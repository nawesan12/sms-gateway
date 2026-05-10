import { maskPhone } from '@/lib/mask.js';
export class AdminController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    listSms = async (req, reply) => {
        const { status, deviceId, from, to } = req.query;
        const page = req.query.page ?? 1;
        const pageSize = req.query.pageSize ?? 50;
        const where = {
            ...(status ? { status: status } : {}),
            ...(deviceId ? { deviceId } : {}),
            ...(from || to
                ? {
                    createdAt: {
                        ...(from ? { gte: new Date(from) } : {}),
                        ...(to ? { lte: new Date(to) } : {}),
                    },
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.smsMessage.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.smsMessage.count({ where }),
        ]);
        reply.send({
            success: true,
            data: {
                items: items.map((it) => ({ ...it, recipientE164: maskPhone(it.recipientE164) })),
                total,
                page,
                pageSize,
            },
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    listOtp = async (req, reply) => {
        const { phone, from, to } = req.query;
        const page = req.query.page ?? 1;
        const pageSize = req.query.pageSize ?? 50;
        const where = {
            ...(phone ? { phoneE164: phone } : {}),
            ...(from || to
                ? {
                    createdAt: {
                        ...(from ? { gte: new Date(from) } : {}),
                        ...(to ? { lte: new Date(to) } : {}),
                    },
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.otpRequest.findMany({
                where,
                select: {
                    id: true,
                    phoneE164: true,
                    attempts: true,
                    maxAttempts: true,
                    expiresAt: true,
                    consumedAt: true,
                    createdAt: true,
                    ipAddress: true,
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.otpRequest.count({ where }),
        ]);
        reply.send({
            success: true,
            data: {
                items: items.map((it) => ({ ...it, phoneE164: maskPhone(it.phoneE164) })),
                total,
                page,
                pageSize,
            },
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
    stats = async (req, reply) => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [sent, delivered, failed, devicesActive, otpRequested] = await Promise.all([
            this.prisma.smsMessage.count({ where: { status: 'SENT', createdAt: { gte: since } } }),
            this.prisma.smsMessage.count({ where: { status: 'DELIVERED', createdAt: { gte: since } } }),
            this.prisma.smsMessage.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
            this.prisma.device.count({ where: { status: 'ACTIVE' } }),
            this.prisma.otpRequest.count({ where: { createdAt: { gte: since } } }),
        ]);
        reply.send({
            success: true,
            data: {
                windowHours: 24,
                otp: { requested: otpRequested },
                sms: { sent, delivered, failed, total: sent + delivered + failed },
                devices: { active: devicesActive },
                costEstimateUsd: 0,
            },
            error: null,
            meta: { requestId: req.correlationId, timestamp: new Date().toISOString() },
        });
    };
}
