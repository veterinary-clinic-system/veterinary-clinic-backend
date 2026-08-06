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

/**
 * Ma tran phan quyen. BR-16: "Chi Admin duoc quan ly role va permission".
 *
 * ---------------------------------------------------------------------------------
 * NGUYEN TAC DUNG `@Roles` va `@RequirePermissions` TRONG TOAN BO DU AN
 * ---------------------------------------------------------------------------------
 * `@RequirePermissions` la hang rao CHINH cho moi endpoint nghiep vu. Ma tran
 * `role_permissions` la nguon su that duy nhat, quan tri vien sua duoc luc chay.
 * Endpoint nghiep vu KHONG kem `@Roles` nua - giu ca hai se tao ra hai danh sach vai
 * tro phai sua song song, va som muon chung se lech nhau.
 *
 * `@Roles` chi con o hai cho, va deu la rang buoc CAU TRUC (khong bao gio duoc phep
 * cau hinh lai luc chay):
 *   1. Be mat quan tri he thong - chinh controller nay, `users`, `branches`. BR-16 noi
 *      "chi Admin", nen ADMIN duoc go cung o tang ma nguon chu khong phai o mot dong
 *      du lieu ma chinh quan tri vien co the xoa nham.
 *   2. Route tu phuc vu cua chu thu cung (`/pets/mine`, `/appointments/mine`) - cac
 *      route nay kiem tra quyen SO HUU chu khong kiem tra permission.
 *
 * PET_OWNER co y khong co dong nao trong `role_permissions`, nen moi endpoint co
 * `@RequirePermissions` deu tu dong tu choi ho. An toan theo mac dinh.
 */
@ApiTags('permissions')
@Controller('permissions')
@Roles(Role.ADMIN)
@RequirePermissions(Permission.ROLE_MANAGE)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /** Danh muc quyen kem cach nhom - de man hinh quan tri dung nhom checkbox. */
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
