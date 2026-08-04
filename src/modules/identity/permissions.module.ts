import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission } from '@/modules/identity/domain/entities/role-permission.entity';
import { PermissionsController } from '@/modules/identity/presentation/permissions.controller';
import { PermissionsService } from '@/modules/identity/application/permissions.service';
import { PermissionsGuard } from '@/modules/identity/infrastructure/guards/permissions.guard';

/**
 * `PermissionsGuard` duoc dang ky APP_GUARD ngay tai day chu khong o AppModule.
 *
 * Ly do: APP_GUARD dang ky o AppModule chi giai quyet duoc phu thuoc nam trong ngu
 * canh cua AppModule. Dat o day thi Nest van bien guard thanh toan cuc, nhung
 * `PermissionsService` duoc giai quyet trong dung module so huu no - AppModule khong
 * phai biet gi ve ben trong identity.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RolePermission])],
  controllers: [PermissionsController],
  providers: [PermissionsService, { provide: APP_GUARD, useClass: PermissionsGuard }],
  exports: [PermissionsService],
})
export class PermissionsModule {}
