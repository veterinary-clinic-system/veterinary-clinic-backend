import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  OwnerNotification,
  OwnerNotificationType,
} from '@/modules/notification/domain/entities/owner-notification.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Role } from '@/shared/common/enums/role.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';

export interface RecordOwnerNotificationParams {
  /** Thông báo tới khách đi theo số điện thoại - tìm ra chủ nuôi có tài khoản từ đó. */
  recipientPhone: string;
  type: OwnerNotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** Cùng một thông báo gửi qua nhiều kênh chỉ ghi một lần. */
  dedupeKey: string;
}

/** Hộp thông báo của chủ nuôi trên app. Ghi hỏng không bao giờ chặn việc gửi thông báo. */
@Injectable()
export class OwnerNotificationsService {
  private readonly logger = new Logger(OwnerNotificationsService.name);

  constructor(
    @InjectRepository(OwnerNotification)
    private readonly repository: Repository<OwnerNotification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async record(params: RecordOwnerNotificationParams): Promise<void> {
    try {
      const owner = await this.users.findOne({
        where: { phone: params.recipientPhone, role: Role.PET_OWNER, active: true },
        select: { id: true },
      });
      if (!owner) return;

      await this.repository
        .createQueryBuilder()
        .insert()
        .into(OwnerNotification)
        .values({
          recipientUserId: owner.id,
          type: params.type,
          title: params.title,
          body: params.body,
          link: params.link ?? null,
          dedupeKey: params.dedupeKey,
        })
        .orIgnore()
        .execute();
    } catch (error) {
      this.logger.error(
        `Không ghi được hộp thông báo (${params.dedupeKey}): ${(error as Error).message}`,
      );
    }
  }

  async findForUser(
    userId: string,
    query: { page: number; limit: number },
  ): Promise<PaginatedResultDto<OwnerNotification>> {
    const [data, total] = await this.repository.findAndCount({
      where: { recipientUserId: userId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  countUnread(userId: string): Promise<number> {
    return this.repository.count({ where: { recipientUserId: userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string): Promise<OwnerNotification> {
    await this.repository.update(
      { id, recipientUserId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    const notification = await this.repository.findOne({ where: { id, recipientUserId: userId } });
    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repository.update(
      { recipientUserId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Xoá tài khoản: hộp thông báo đi theo. */
  async removeAllFor(userId: string): Promise<void> {
    await this.repository.delete({ recipientUserId: userId });
  }
}
