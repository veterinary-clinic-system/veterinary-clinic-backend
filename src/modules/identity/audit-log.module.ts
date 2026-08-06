import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@/modules/identity/domain/entities/audit-log.entity';
import { AuditLogService } from '@/modules/identity/application/audit-log.service';
import { AuditLogsController } from '@/modules/identity/presentation/audit-logs.controller';
import { AUDIT_RECORDER } from '@/shared/common/audit/audit-recorder.port';

/**
 * Nhat ky kiem toan - SRS FR-26, BR-17 (P10-T1).
 *
 * Composition root cua audit: noi port `AUDIT_RECORDER` (o `shared`) voi adapter that
 * (`AuditLogService`, o day). `AuditInterceptor` nam ben `shared` chi biet cai port -
 * xem `audit-recorder.port.ts` de ro ly do.
 *
 * `AUDIT_RECORDER` duoc EXPORT vi `AppModule` la noi dang ky interceptor toan cuc, va
 * Nest phai giai duoc phu thuoc do tu injector cua AppModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogsController],
  providers: [AuditLogService, { provide: AUDIT_RECORDER, useExisting: AuditLogService }],
  exports: [AuditLogService, AUDIT_RECORDER],
})
export class AuditLogModule {}
