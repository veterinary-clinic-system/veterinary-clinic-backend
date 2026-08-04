import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EmployeeStatus } from '@/shared/common/enums/employee-status.enum';

/**
 * `employeeCode` va `phone` khong khai bao o day co chu dich: ma nhan vien do he thong
 * sinh va duoc dung lam dinh danh trong giay to noi bo, con so dien thoai la dinh danh
 * dang nhap cua tai khoan lien ket. Doi mot trong hai la nghiep vu "tao ho so moi".
 */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

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
}
