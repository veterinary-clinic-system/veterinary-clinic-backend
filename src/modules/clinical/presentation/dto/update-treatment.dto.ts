import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /treatments/:id`.
 *
 * `endDate` la truong DUY NHAT trong DTO nay nhan `null` mot cach co y nghia: dat lai
 * ve null nghia la "dieu tri chua ket thuc" (vi du bac si dong nham ngay ket thuc).
 * `@ValidateIf` cho `null` di qua ma van bat chuoi rac.
 */
export class UpdateTreatmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  method?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
