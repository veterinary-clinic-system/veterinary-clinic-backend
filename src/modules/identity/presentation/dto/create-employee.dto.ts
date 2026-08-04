import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EmployeeStatus } from '@/shared/common/enums/employee-status.enum';
import { Role } from '@/shared/common/enums/role.enum';

/** Tuy chon tao kem tai khoan dang nhap cho nhan vien. */
export class CreateEmployeeAccountDto {
  @IsEnum(Role)
  role: Role;

  @IsString()
  @MinLength(8)
  password: string;
}

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @IsPhoneNumber('VN')
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  position?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  note?: string;

  /**
   * Bo trong = tao ho so nhan su thuan, khong co tai khoan dang nhap. Rat nhieu nhan
   * vien khong bao gio dung phan mem - xem ghi chu trong employee.entity.ts.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEmployeeAccountDto)
  account?: CreateEmployeeAccountDto;
}
