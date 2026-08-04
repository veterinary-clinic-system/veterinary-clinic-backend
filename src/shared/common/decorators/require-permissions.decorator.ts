import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/permission.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Yeu cau nguoi goi co TAT CA cac quyen liet ke. Duoc `PermissionsGuard` thuc thi.
 *
 * Dung KEM `@Roles(...)` chu khong thay the no: `@Roles` la hang rao tho theo vai tro
 * (nhanh, khong cham CSDL), `@RequirePermissions` la hang rao tinh theo quyen (quan tri
 * vien sua duoc luc chay). Endpoint nao co ca hai thi phai qua ca hai.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
