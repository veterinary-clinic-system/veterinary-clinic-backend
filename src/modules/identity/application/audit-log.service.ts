import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuditLog } from '@/modules/identity/domain/entities/audit-log.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { QueryAuditLogsDto } from '@/modules/identity/presentation/dto/query-audit-logs.dto';
import { AuditRecordParams, AuditRecorder } from '@/shared/common/audit/audit-recorder.port';

/** Mot dong nhat ky kem ten nguoi thuc hien - hinh dang tra ve cua `GET /audit-logs`. */
export interface AuditLogView extends AuditLog {
  /** `null` khi hanh dong do he thong lam, hoac tai khoan da bi xoa cung. */
  actorName: string | null;
  actorPhone: string | null;
}

/**
 * Nhat ky kiem toan - SRS FR-26, BR-17 (P10-T1).
 *
 * Bang `audit_logs` co tu dau du an (Phan V.4 quyet dinh #8, phan manh theo thang) nhung
 * **chua mot dong nao duoc ghi** cho toi P10. Service nay la cho duy nhat ghi vao no.
 *
 * BAT BIEN: nhat ky la BAT BIEN. Khong co `update`, khong co `delete` o day va se khong
 * bao gio co - mot ban ghi kiem toan sua duoc thi khong con la ban ghi kiem toan. Don du
 * lieu cu la viec cua `DROP PARTITION` o tang van hanh, khong phai cua ung dung.
 */
@Injectable()
export class AuditLogService implements AuditRecorder {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  /**
   * Ghi mot dong nhat ky, KHONG BAO GIO NEM LOI.
   *
   * Day la diem cot loi cua P10-T1 va la ly do ham nay `catch` het: audit la thu ghi
   * BEN CANH nghiep vu, khong phai mot phan cua no. Neu bang audit day dia, partition
   * thang nay chua duoc tao, hay CSDL nghen - khach van phai thanh toan duoc. Doi lai,
   * moi that bai deu duoc ghi vao log ung dung o muc `error`, nen mot he thong audit
   * dang chet khong im lang.
   *
   * Nguoi goi (`AuditInterceptor`) khong `await` ham nay: request tra ve truoc, dong
   * audit ghi sau. Cai mat di la mot cua so rat hep - tien trinh chet dung giua hai thoi
   * diem do thi dong audit mat. Cach duy nhat de dong cua so ay la ghi trong CUNG
   * transaction nghiep vu (mau outbox), nhung khi ay audit hong SE lam rollback giao dich
   * - dung dieu ma P10-T1 cam. Da chon mat mot dong audit hiem hoi thay vi mat mot lan
   * thanh toan.
   */
  record(params: AuditRecordParams): void {
    void this.auditLogsRepository
      .insert({
        actorUserId: params.actorUserId,
        action: params.action,
        entityName: params.entityName,
        entityId: params.entityId,
        // Ep kieu: cung ly do da ghi o `OutboxService.record` - TypeORM mo ta gia tri
        // cot bang `_QueryDeepPartialEntity`, kieu do hieu nham mot `Record<string,
        // unknown>` tuy y la "doi tuong quan he long nhau" chu khong phai mot gia tri
        // jsonb nguyen khoi.
        changes: params.changes as unknown as Record<string, never>,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      })
      .catch((error: Error) => {
        this.logger.error(
          `Khong ghi duoc nhat ky kiem toan (${params.action} ${params.entityName} ` +
            `${params.entityId ?? '-'}): ${error.message}`,
        );
      });
  }

  /** Ban dong bo - chi dung trong test va script kiem chung, de doc lai duoc ngay. */
  async recordAndWait(params: AuditRecordParams): Promise<void> {
    await this.auditLogsRepository.insert({
      actorUserId: params.actorUserId,
      action: params.action,
      entityName: params.entityName,
      entityId: params.entityId,
      changes: params.changes as unknown as Record<string, never>,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  /**
   * Trang xem nhat ky - loc theo nguoi thuc hien / thuc the / hanh dong / khoang ngay
   * (acceptance P10-T2).
   *
   * Sap theo `createdAt` giam dan va KHONG cho doi cot sap xep: bang phan manh theo
   * `created_at`, nen moi truy van khac thu tu do se phai quet toan bo cac partition.
   */
  async findAll(query: QueryAuditLogsDto): Promise<PaginatedResultDto<AuditLog>> {
    const where: FindOptionsWhere<AuditLog> = {};

    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.action) where.action = query.action;
    if (query.entityName) where.entityName = query.entityName;
    if (query.entityId) where.entityId = query.entityId;

    const from = query.from ? new Date(`${query.from}T00:00:00`) : undefined;
    const to = query.to ? new Date(`${query.to}T23:59:59.999`) : undefined;
    if (from && to) {
      where.createdAt = Between(from, to);
    } else if (from) {
      where.createdAt = MoreThanOrEqual(from);
    } else if (to) {
      where.createdAt = LessThanOrEqual(to);
    }

    const [data, total] = await this.auditLogsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return new PaginatedResultDto(await this.withActorNames(data), total, query.page, query.limit);
  }

  /**
   * Gan ten nguoi thuc hien vao tung dong.
   *
   * KHONG dung quan he TypeORM giua `AuditLog` va `User`: mot khoa ngoai tu bang audit
   * sang bang nguoi dung se ngan viec xoa tai khoan, ma nhat ky thi phai song lau hon
   * chinh doi tuong no ghi lai (do la ly do bang nay ton tai). Nen o day doc rieng mot
   * lan cho ca trang - mot truy van phu, khong phai N.
   *
   * Tai khoan da bi xoa cung -> khong tim thay ten -> `actorName` la `null`, va giao dien
   * hien lai ma dinh danh. Mot dong nhat ky mat ten van la mot dong nhat ky hop le.
   */
  private async withActorNames(rows: AuditLog[]): Promise<AuditLogView[]> {
    const ids = [...new Set(rows.map((row) => row.actorUserId).filter((id): id is string => !!id))];
    if (ids.length === 0) {
      return rows.map((row) => ({ ...row, actorName: null, actorPhone: null }));
    }

    const users = await this.auditLogsRepository.manager.find(User, {
      where: { id: In(ids) },
      select: { id: true, fullName: true, phone: true },
      withDeleted: true,
    });
    const byId = new Map(users.map((user) => [user.id, user]));

    return rows.map((row) => {
      const actor = row.actorUserId ? byId.get(row.actorUserId) : undefined;
      return {
        ...row,
        actorName: actor?.fullName ?? null,
        actorPhone: actor?.phone ?? null,
      };
    });
  }
}
