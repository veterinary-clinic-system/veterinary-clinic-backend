import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DiagnosisSeverity } from '@/shared/common/enums/medical-record-status.enum';

export class UpdateDiagnosisDto {
  @IsOptional()
  @IsUUID()
  diseaseId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosisText?: string;

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
