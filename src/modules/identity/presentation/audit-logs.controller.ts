import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/shared/common/audit/audit-catalog';
import { AuditLogService } from '@/modules/identity/application/audit-log.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

/**
 * Trang xem nhat ky kiem toan - SRS FR-26, BR-17 (P10-T2).
 *
 * CHI DOC. Khong co POST/PATCH/DELETE o day va se khong bao gio co - xem ghi chu dau
 * `AuditLogService`. `AUDIT_VIEW` trong ma tran quyen mac dinh chi thuoc ve ADMIN.
 */
@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /** Cac gia tri de dung o chon cua bo loc - de giao dien khong hard-code danh sach. */
  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get('filters')
  filters() {
    return { actions: AUDIT_ACTIONS, entities: AUDIT_ENTITIES };
  }

  @RequirePermissions(Permission.AUDIT_VIEW)
  @Get()
  findAll(@Query() query: QueryAuditLogsDto) {
    return this.auditLogService.findAll(query);
  }
}
