import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { Specialization } from '@/common/enums/specialization.enum';

/** Admin edit of a Doctor's clinical profile (`PATCH /users/doctors/:id`). */
export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  yearOfStart?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(Specialization, { each: true })
  specialization?: Specialization[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
