import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/shared/common/audit/audit-catalog';
import { AuditLogService } from '@/modules/identity/application/audit-log.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

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
