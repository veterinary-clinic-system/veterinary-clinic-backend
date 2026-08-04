import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { Permission } from '@/shared/common/enums/permission.enum';

/**
 * Thay TOAN BO tap quyen cua mot vai tro (PUT chu khong phai PATCH). Man hinh ma tran
 * luon gui ve day du trang thai cac o tick, nen gui ca tap la dung ngu nghia va tranh
 * duoc tinh huong hai quan tri vien sua cung luc rot mat thay doi cua nhau.
 */
export class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
