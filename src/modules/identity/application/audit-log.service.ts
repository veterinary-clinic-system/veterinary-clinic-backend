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

export interface AuditLogView extends AuditLog {
  
  actorName: string | null;
  actorPhone: string | null;
}

@Injectable()
export class AuditLogService implements AuditRecorder {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog) private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  record(params: AuditRecordParams): void {
    void this.auditLogsRepository
      .insert({
        actorUserId: params.actorUserId,
        action: params.action,
        entityName: params.entityName,
        entityId: params.entityId,

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
