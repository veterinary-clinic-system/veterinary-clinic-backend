import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { StaffNotification } from '@/modules/notification/domain/entities/staff-notification.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import {
  STAFF_NOTIFICATION_RECIPIENTS,
  StaffNotificationType,
} from '@/shared/common/enums/staff-notification.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';

export interface NotifyStaffParams {
  type: StaffNotificationType;
  title: string;
  body: string;
  link?: string | null;
  
  branchId?: string | null;
  
  dedupeKey: string;
}

export interface StaffNotificationQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

@Injectable()
export class StaffNotificationsService {
  private readonly logger = new Logger(StaffNotificationsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get repository(): Repository<StaffNotification> {
    return this.dataSource.getRepository(StaffNotification);
  }

  async notify(manager: EntityManager, params: NotifyStaffParams): Promise<number> {
    try {
      const roles = STAFF_NOTIFICATION_RECIPIENTS[params.type];
      const recipients = await this.resolveRecipients(manager, roles, params.branchId ?? null);
      if (recipients.length === 0) {
        return 0;
      }

      const result = await manager
        .createQueryBuilder()
        .insert()
        .into(StaffNotification)
        .values(
          recipients.map((userId) => ({
            recipientUserId: userId,
            type: params.type,
            title: params.title,
            body: params.body,
            link: params.link ?? null,
            branchId: params.branchId ?? null,

            dedupeKey: `${params.dedupeKey}:${userId}`,
          })),
        )
        .orIgnore()
        .execute();

      return result.identifiers.filter(Boolean).length;
    } catch (error) {
      this.logger.error(
        `Khong phat duoc thong bao ${params.type} (${params.dedupeKey}): ${(error as Error).message}`,
      );
      return 0;
    }
  }

  private async resolveRecipients(
    manager: EntityManager,
    roles: string[],
    branchId: string | null,
  ): Promise<string[]> {
    const rows = await manager
      .createQueryBuilder(User, 'user')
      .select('user.id', 'id')
      .where('user.role IN (:...roles)', { roles })
      .andWhere('user.active = true')
      .andWhere('user.deleted_at IS NULL')
      .andWhere(branchId ? '(user.branch_id = :branchId OR user.branch_id IS NULL)' : '1 = 1', {
        branchId,
      })
      .getRawMany<{ id: string }>();

    return rows.map((row) => row.id);
  }

  async findForUser(
    userId: string,
    query: StaffNotificationQuery,
  ): Promise<PaginatedResultDto<StaffNotification>> {
    const [data, total] = await this.repository.findAndCount({
      where: {
        recipientUserId: userId,
        ...(query.unreadOnly ? { readAt: IsNull() } : {}),
      },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  countUnread(userId: string): Promise<number> {
    return this.repository.count({ where: { recipientUserId: userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string): Promise<StaffNotification> {

    await this.repository.update(
      { id, recipientUserId: userId, readAt: IsNull() },
      { readAt: new Date() },
    );

    const notification = await this.repository.findOne({
      where: { id, recipientUserId: userId },
    });
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
}
