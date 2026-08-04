import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DiagnosisSeverity } from '@/shared/common/enums/medical-record-status.enum';

/**
 * Them mot chan doan vao ho so - `POST /medical-records/:id/diagnoses` (SRS FR-09).
 *
 * `diseaseId` tuy chon co chu dich: bac si chan doan mot benh chua co trong danh muc
 * van phai ghi duoc bang `diagnosisText` - xem ghi chu trong `diagnosis.entity.ts`.
 *
 * `isPrimary` mac dinh do SERVICE quyet dinh chu khong phai DTO: chan doan dau tien
 * cua mot ho so tu dong thanh chan doan chinh, nen `undefined` va `false` phai phan
 * biet duoc.
 */
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
