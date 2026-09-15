import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@/modules/identity/domain/entities/audit-log.entity';
import { AuditLogService } from '@/modules/identity/application/audit-log.service';
import { AuditLogsController } from '@/modules/identity/presentation/audit-logs.controller';
import { AUDIT_RECORDER } from '@/shared/common/audit/audit-recorder.port';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogsController],
  providers: [AuditLogService, { provide: AUDIT_RECORDER, useExisting: AuditLogService }],
  exports: [AuditLogService, AUDIT_RECORDER],
})
export class AuditLogModule {}
