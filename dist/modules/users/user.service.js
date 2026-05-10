import { UserRepository } from './user.repository.js';
import { AppError } from '@/plugins/error-handler.js';
import { ERROR_CODES } from '@/config/constants.js';
export class UserService {
    repo;
    constructor(prisma) {
        this.repo = new UserRepository(prisma);
    }
    async getOrCreateByPhone(phoneE164) {
        const user = await this.repo.upsertByPhone(phoneE164);
        if (user.isBlocked) {
            throw new AppError(ERROR_CODES.BLACKLISTED, 'User is blocked', 403);
        }
        return user;
    }
}
