import type { PrismaClient } from '@prisma/client';

export type TryReserveResult = { ok: true; balanceAfter: number } | { ok: false; balance: number };

export class TokensRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async tryReserve(userId: string, amount: number): Promise<TryReserveResult> {
    const rows = await this.prisma.$queryRaw<{ amount: number }[]>`
      UPDATE token_balance
         SET amount = amount - ${amount},
             "updatedAt" = NOW()
       WHERE "userId" = ${userId} AND amount >= ${amount}
       RETURNING amount
    `;
    const head = rows[0];
    if (head) {
      return { ok: true, balanceAfter: head.amount };
    }
    const current = await this.prisma.tokenBalance.findUnique({
      where: { userId },
      select: { amount: true },
    });
    return { ok: false, balance: current?.amount ?? 0 };
  }

  // UPSERT: si no existe la fila del User, la crea con `amount`.
  async addAmount(userId: string, amount: number): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ amount: number }[]>`
      INSERT INTO token_balance ("userId", amount, "createdAt", "updatedAt")
      VALUES (${userId}, ${amount}, NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE
        SET amount = token_balance.amount + EXCLUDED.amount,
            "updatedAt" = NOW()
      RETURNING amount
    `;
    const head = rows[0];
    if (!head) {
      throw new Error(`failed to upsert token_balance for user=${userId}`);
    }
    return head.amount;
  }

  async getBalance(userId: string): Promise<{ amount: number; updatedAt: Date }> {
    const row = await this.prisma.tokenBalance.findUnique({
      where: { userId },
      select: { amount: true, updatedAt: true },
    });
    if (!row) {
      return { amount: 0, updatedAt: new Date(0) };
    }
    return row;
  }
}
