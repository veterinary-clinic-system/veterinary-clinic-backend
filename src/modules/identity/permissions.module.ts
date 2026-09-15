import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission } from '@/modules/identity/domain/entities/role-permission.entity';
import { PermissionsController } from '@/modules/identity/presentation/permissions.controller';
import { PermissionsService } from '@/modules/identity/application/permissions.service';
import { PermissionsGuard } from '@/modules/identity/infrastructure/guards/permissions.guard';

@Module({
  imports: [TypeOrmModule.forFeature([RolePermission])],
  controllers: [PermissionsController],
  providers: [PermissionsService, { provide: APP_GUARD, useClass: PermissionsGuard }],
  exports: [PermissionsService],
})
export class PermissionsModule {}
