import { IsOptional, IsString, IsUUID } from 'class-validator';

export class OpenMedicalRecordDto {
  @IsUUID()
  appointmentId: string;

  @IsOptional()
  @IsString()
  visitReason?: string;

  @IsOptional()
  @IsString()
  generalCondition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
