import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Them mot phuong phap dieu tri vao ho so - `POST /medical-records/:id/treatments`
 * (SRS FR-10).
 *
 * `endDate` bo trong = dieu tri dang tiep dien. Rang buoc `endDate >= startDate` duoc
 * kiem trong `MedicalRecordsService` chu khong o day: khi PATCH chi gui MOT trong hai
 * ngay, ngay con lai phai lay tu ban ghi dang co - mot decorator cap DTO khong nhin
 * thay du lieu do.
 */
export class CreateTreatmentDto {
  @IsString()
  @MaxLength(255)
  method: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
