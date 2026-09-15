import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DiagnosisSeverity } from '@/shared/common/enums/medical-record-status.enum';

export class CreateDiagnosisDto {
  @IsOptional()
  @IsUUID()
  diseaseId?: string;

  @IsString()
  @MaxLength(2000)
  diagnosisText: string;

  @IsOptional()
  @IsEnum(DiagnosisSeverity)
  severity?: DiagnosisSeverity;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
