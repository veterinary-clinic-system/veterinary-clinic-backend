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

/**
 * Admin-only staff account creation (DOCTOR/RECEPTIONIST/ADMIN). PetOwner accounts are
 * never created through this endpoint - they come from the public booking flow or
 * self-registration (see AuthService.registerPetOwner). `branchId` is required for
 * DOCTOR/RECEPTIONIST (both are branch-scoped per the domain rules) and is ignored/forced
 * to null for ADMIN (global/HQ) by UsersService. `yearOfStart`/`specialization` only
 * matter when `role` is DOCTOR, in which case UsersService also creates the linked
 * `Doctor` clinical-profile row in the same transaction as the `User` insert.
 */
export class CreateUserDto {
  @IsPhoneNumber('VN')
  phone: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn([Role.ADMIN, Role.DOCTOR, Role.RECEPTIONIST], {
    message: 'role must be one of the following values: ADMIN, DOCTOR, RECEPTIONIST',
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
