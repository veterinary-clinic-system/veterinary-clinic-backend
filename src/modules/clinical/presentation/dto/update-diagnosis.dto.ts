import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DiagnosisSeverity } from '@/shared/common/enums/medical-record-status.enum';

/**
 * `PATCH /diagnoses/:id`. Cung cac truong CreateDiagnosisDto nhung deu tuy chon.
 *
 * `medicalRecordId` khong co o day: chuyen mot chan doan sang ho so khac khong phai
 * la sua, ma la ghi lai benh su cua mot lan kham khac - viec do phai xoa va them lai.
 */
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
