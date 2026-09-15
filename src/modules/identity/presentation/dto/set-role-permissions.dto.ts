import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { Permission } from '@/shared/common/enums/permission.enum';

export class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true })
  permissions: Permission[];
}
