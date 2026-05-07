import { describe, it, expect, beforeEach } from 'vitest';
import type { TokenTransactionType } from '@prisma/client';
import { TokenTransactionStatus } from '@prisma/client';
import { TokensService } from '@/modules/tokens/tokens.service.js';

const fakeLogger = { warn() {}, info() {}, error() {}, debug() {} } as never;

interface StoredTransaction {
  id: string;
  userId: string;
  type: TokenTransactionType;
  status: TokenTransactionStatus;
  amount: number;
  balanceAfter: number;
  smsMessageId: string | null;
  reason: string | null;
  actorType: string | null;
  actorId: string | null;
  correlationId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

function makePrismaStub(initial: Record<string, number> = {}) {
  const balances = new Map<string, number>(Object.entries(initial));
  const txs = new Map<string, StoredTransaction>();
  const state = { auditCalls: 0, counter: 0, balances, txs };

  const prisma = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      // Reserve: UPDATE token_balance SET amount = amount - ${amount} WHERE userId=${userId} AND amount >= ${amount}
      if (/UPDATE token_balance/.test(sql) && /amount - /.test(sql)) {
        const userId = values.find((v) => typeof v === 'string') as string;
        const numbers = values.filter((v) => typeof v === 'number') as number[];
        const required = numbers[0] ?? 0;
        const current = balances.get(userId) ?? 0;
        if (current >= required) {
          balances.set(userId, current - required);
          return [{ amount: current - required }];
        }
        return [];
      }
      // UPSERT addAmount
      if (/INSERT INTO token_balance/.test(sql)) {
        const userId = values.find((v) => typeof v === 'string') as string;
        const numbers = values.filter((v) => typeof v === 'number') as number[];
        const amount = numbers[0] ?? 0;
        const current = balances.get(userId) ?? 0;
        const next = current + amount;
        balances.set(userId, next);
        return [{ amount: next }];
      }
      return [];
    },
    tokenBalance: {
      findUnique: async ({ where }: { where: { userId: string } }) => {
        const amount = balances.get(where.userId);
        if (amount === undefined) return null;
        return { userId: where.userId, amount, updatedAt: new Date() };
      },
    },
    tokenTransaction: {
      create: async ({ data }: { data: Partial<StoredTransaction> }) => {
        const id = `tx_${++state.counter}`;
        const tx: StoredTransaction = {
          id,
          userId: (data.userId ?? '') as string,
          type: data.type as TokenTransactionType,
          status: (data.status ?? TokenTransactionStatus.RESERVED) as TokenTransactionStatus,
          amount: data.amount ?? 0,
          balanceAfter: data.balanceAfter ?? 0,
          smsMessageId: data.smsMessageId ?? null,
          reason: data.reason ?? null,
          actorType: data.actorType ?? null,
          actorId: data.actorId ?? null,
          correlationId: data.correlationId ?? null,
          metadata: data.metadata ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        txs.set(id, tx);
        return tx;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; type: TokenTransactionType; status: TokenTransactionStatus };
        data: { status: TokenTransactionStatus };
      }) => {
        const tx = txs.get(where.id);
        if (!tx || tx.type !== where.type || tx.status !== where.status) {
          return { count: 0 };
        }
        tx.status = data.status;
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => txs.get(where.id) ?? null,
      findMany: async ({ where }: { where: { userId?: string } } = { where: {} }) => {
        return [...txs.values()].filter((t) => !where?.userId || t.userId === where.userId);
      },
      count: async ({ where }: { where: { userId?: string } } = { where: {} }) => {
        return [...txs.values()].filter((t) => !where?.userId || t.userId === where.userId).length;
      },
    },
    auditLog: {
      create: async () => {
        state.auditCalls += 1;
        return { id: `a_${state.auditCalls}` };
      },
    },
  };
  return { prisma: prisma as never, state };
}

const USER_A = 'user_a';
const USER_B = 'user_b';

describe('TokensService.reserve (multi-tenant)', () => {
  let stub: ReturnType<typeof makePrismaStub>;
  let svc: TokensService;

  beforeEach(() => {
    stub = makePrismaStub({ [USER_A]: 10, [USER_B]: 5 });
    svc = new TokensService(stub.prisma, fakeLogger);
  });

  it('reserva descuenta del balance del User correcto sin tocar otros', async () => {
    const r = await svc.reserve({ userId: USER_A, amount: 1, smsMessageId: 'sms_1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(stub.state.balances.get(USER_A)).toBe(9);
    expect(stub.state.balances.get(USER_B)).toBe(5); // intacto
  });

  it('rechaza con saldo insuficiente del User sin afectar a otros', async () => {
    const r = await svc.reserve({ userId: USER_B, amount: 999, smsMessageId: 'sms_1' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.balance).toBe(5);
    expect(stub.state.balances.get(USER_A)).toBe(10);
    expect(stub.state.balances.get(USER_B)).toBe(5);
  });
});

describe('TokensService.commit/refund (idempotencia)', () => {
  it('commit confirma una sola vez y no toca el balance', async () => {
    const stub = makePrismaStub({ [USER_A]: 10 });
    const svc = new TokensService(stub.prisma, fakeLogger);
    const r = await svc.reserve({ userId: USER_A, amount: 1, smsMessageId: 'sms_1' });
    if (!r.ok) throw new Error('reserva debió pasar');

    expect(await svc.commit(r.transactionId)).toBe(true);
    expect(await svc.commit(r.transactionId)).toBe(false);
    expect(stub.state.balances.get(USER_A)).toBe(9);
  });

  it('refund devuelve los tokens al User correcto una sola vez', async () => {
    const stub = makePrismaStub({ [USER_A]: 10 });
    const svc = new TokensService(stub.prisma, fakeLogger);
    const r = await svc.reserve({ userId: USER_A, amount: 3, smsMessageId: 'sms_1' });
    if (!r.ok) throw new Error('reserva debió pasar');

    expect(stub.state.balances.get(USER_A)).toBe(7);
    expect(await svc.refund(r.transactionId, 'test')).toBe(true);
    expect(stub.state.balances.get(USER_A)).toBe(10);
    expect(await svc.refund(r.transactionId, 'test')).toBe(false);
    expect(stub.state.balances.get(USER_A)).toBe(10);
  });

  it('no refundea si la reserva ya fue committed', async () => {
    const stub = makePrismaStub({ [USER_A]: 10 });
    const svc = new TokensService(stub.prisma, fakeLogger);
    const r = await svc.reserve({ userId: USER_A, amount: 2, smsMessageId: 'sms_1' });
    if (!r.ok) throw new Error('reserva debió pasar');
    await svc.commit(r.transactionId);
    expect(stub.state.balances.get(USER_A)).toBe(8);
    expect(await svc.refund(r.transactionId, 'late')).toBe(false);
    expect(stub.state.balances.get(USER_A)).toBe(8);
  });
});

describe('TokensService.topUp (UPSERT)', () => {
  it('crea fila para User nuevo y suma a fila existente', async () => {
    const stub = makePrismaStub();
    const svc = new TokensService(stub.prisma, fakeLogger);

    const out1 = await svc.topUp({
      userId: USER_A,
      amount: 500,
      reason: 'pago inicial',
      actorType: 'admin',
    });
    expect(out1.balance).toBe(500);
    expect(stub.state.balances.get(USER_A)).toBe(500);

    const out2 = await svc.topUp({
      userId: USER_A,
      amount: 100,
      reason: 'recarga',
      actorType: 'admin',
    });
    expect(out2.balance).toBe(600);
  });

  it('topUp de un User no afecta a otro', async () => {
    const stub = makePrismaStub({ [USER_A]: 100 });
    const svc = new TokensService(stub.prisma, fakeLogger);

    await svc.topUp({ userId: USER_B, amount: 50, reason: 'r', actorType: 'admin' });
    expect(stub.state.balances.get(USER_A)).toBe(100);
    expect(stub.state.balances.get(USER_B)).toBe(50);
  });
});

describe('TokensService.listTransactions', () => {
  it('filtra por userId — no mezcla transacciones entre clientes', async () => {
    const stub = makePrismaStub({ [USER_A]: 100, [USER_B]: 100 });
    const svc = new TokensService(stub.prisma, fakeLogger);

    await svc.reserve({ userId: USER_A, amount: 5, smsMessageId: 'a1' });
    await svc.reserve({ userId: USER_B, amount: 3, smsMessageId: 'b1' });
    await svc.reserve({ userId: USER_A, amount: 7, smsMessageId: 'a2' });

    const aOnly = await svc.listTransactions({ userId: USER_A, page: 1, pageSize: 50 });
    expect(aOnly.items.every((t) => t.userId === USER_A)).toBe(true);
    expect(aOnly.items.length).toBe(2);

    const bOnly = await svc.listTransactions({ userId: USER_B, page: 1, pageSize: 50 });
    expect(bOnly.items.every((t) => t.userId === USER_B)).toBe(true);
    expect(bOnly.items.length).toBe(1);
  });
});
