import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Role } from '@/shared/common/enums/role.enum';
import { Specialization } from '@/shared/common/enums/specialization.enum';

export class CreateUserDto {
  @IsPhoneNumber('VN')
  phone: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn([Role.ADMIN, Role.MANAGER, Role.DOCTOR, Role.RECEPTIONIST, Role.PHARMACIST, Role.STAFF], {
    message: 'Vai tro nhan vien khong hop le',
  })
  role: Role;

  @ValidateIf((dto: CreateUserDto) => dto.role === Role.DOCTOR || dto.role === Role.RECEPTIONIST)
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearOfStart?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(Specialization, { each: true })
  specialization?: Specialization[];
}
