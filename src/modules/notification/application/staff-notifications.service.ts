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
  /**
   * Chi nhanh phat sinh su kien. Co gia tri -> chi nguoi thuoc chi nhanh do (va cac vai
   * tro khong gan chi nhanh, vi du ADMIN) duoc nhan. Bo trong -> toan he thong.
   */
  branchId?: string | null;
  /** Suy ra TAT DINH tu du kien nghiep vu - xem `StaffNotification.dedupeKey`. */
  dedupeKey: string;
}

export interface StaffNotificationQuery {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}

/**
 * Hop thu trong ung dung cua nhan vien - SRS FR-23 muc 18 (P10-T5).
 *
 * KHONG DI QUA OUTBOX. Outbox ton tai de bao dam mot su kien nghiep vu chac chan den
 * duoc mot he thong BEN NGOAI (SMS, Zalo) du nha cung cap do dang chet. Thong bao trong
 * ung dung khong roi khoi CSDL nay - viet thang trong chinh transaction nghiep vu la vua
 * du bao dam va bot han mot chang. Nguoc lai, no cung co nghia: transaction rollback thi
 * thong bao cung bien mat, va do la dieu dung.
 */
@Injectable()
export class StaffNotificationsService {
  private readonly logger = new Logger(StaffNotificationsService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get repository(): Repository<StaffNotification> {
    return this.dataSource.getRepository(StaffNotification);
  }

  /**
   * Phat mot thong bao toi moi nguoi co vai tro tuong ung (bang muc 18 SRS).
   *
   * @param manager EntityManager cua transaction nghiep vu dang chay. Truyen vao de
   *   thong bao va thay doi nghiep vu cung song cung chet; goi ngoai transaction cung
   *   duoc, khi do no la mot lenh ghi doc lap.
   *
   * KHONG NEM LOI. Cung nguyen tac voi `AuditLogService.record`: mot canh bao ton kho
   * khong gui duoc thi khong duoc phep lam hong lan thanh toan hay lan nhap kho da xong.
   */
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
            // Khoa gom ca nguoi nhan: cung mot su kien nhung moi nguoi mot dong rieng,
            // nen khoa chi theo su kien se lam chin nguoi sau bi bo qua.
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

  /**
   * Nguoi dung thuoc cac vai tro can nhan, con hoat dong.
   *
   * LOC CHI NHANH CO MOT NGOAI LE CO CHU DICH: tai khoan khong gan chi nhanh nao
   * (`branch_id IS NULL` - ADMIN va cac vai tro dieu hanh) luon nhan, du su kien xay ra
   * o dau. Neu loc cung theo chi nhanh thi quan tri vien se khong bao gio thay mot canh
   * bao nao ca, vi ho khong dung o chi nhanh nao het.
   */
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

  // -------------------------------------------------------------- Doc hop thu

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

  /**
   * Danh dau da doc. Rang buoc `recipientUserId` nam trong dieu kien WHERE chu khong
   * phai mot lenh kiem tra rieng: nho vay khong the danh dau ho thong bao cua nguoi khac,
   * va cung khong lo ra rang id do co ton tai hay khong.
   */
  async markRead(userId: string, id: string): Promise<StaffNotification> {
    // Khong kiem tra `affected`: bang 0 chi nghia la dong do da duoc doc tu truoc, va
    // bam hai lan thi khong phai loi. Truong hop that su sai - id khong ton tai hoac
    // thuoc ve nguoi khac - lo ra o buoc doc lai ngay duoi.
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
