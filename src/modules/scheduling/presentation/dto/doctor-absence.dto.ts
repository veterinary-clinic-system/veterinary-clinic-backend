import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class DoctorAbsenceDto {
  @IsUUID(undefined, { message: 'Bác sĩ không hợp lệ' })
  doctorId: string;

  @IsDateString({}, { message: 'Ngày nghỉ không hợp lệ' })
  date: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => value !== false && value !== 'false')
  @IsBoolean()
  reassign?: boolean;
}
