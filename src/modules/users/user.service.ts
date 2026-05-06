import type { PrismaClient, User } from '@prisma/client';
import { UserRepository } from './user.repository.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';

export class UserService {
  private readonly repo: UserRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new UserRepository(prisma);
  }

  async getOrCreateByPhone(phoneE164: string): Promise<User> {
    const user = await this.repo.upsertByPhone(phoneE164);
    if (user.isBlocked) {
      throw new AppError(ERROR_CODES.BLACKLISTED, 'User is blocked', 403);
    }
    return user;
  }
}
