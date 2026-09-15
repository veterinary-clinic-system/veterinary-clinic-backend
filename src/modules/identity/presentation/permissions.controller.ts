import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { PermissionsService } from '@/modules/identity/application/permissions.service';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('permissions')
@Controller('permissions')
@Roles(Role.ADMIN)
@RequirePermissions(Permission.ROLE_MANAGE)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('catalog')
  getCatalog() {
    return this.permissionsService.getCatalog();
  }

  @Get('matrix')
  getMatrix() {
    return this.permissionsService.getMatrix();
  }

  @Audit({ action: AuditAction.UPDATE, entity: 'RolePermission', snapshot: false })
  @Put('roles/:role')
  async setRolePermissions(@Param('role') role: Role, @Body() dto: SetRolePermissionsDto) {
    const permissions = await this.permissionsService.setRolePermissions(role, dto.permissions);
    return { role, permissions };
  }

  @Audit({ action: AuditAction.UPDATE, entity: 'RolePermission', snapshot: false })
  @Post('roles/:role/reset')
  async resetRole(@Param('role') role: Role) {
    const permissions = await this.permissionsService.resetRoleToDefault(role);
    return { role, permissions };
  }
}
