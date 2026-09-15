import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AssignDoctorDto {
  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;
}
