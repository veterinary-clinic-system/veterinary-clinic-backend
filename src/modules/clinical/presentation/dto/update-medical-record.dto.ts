import { IsOptional, IsString } from 'class-validator';

export class UpdateMedicalRecordDto {
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
