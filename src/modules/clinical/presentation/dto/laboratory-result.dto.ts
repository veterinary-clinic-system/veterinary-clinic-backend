import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';

/** Mot chi so trong ket qua xet nghiem - SRS FR-13-02 (P9-T5). */
export class LaboratoryResultDto {
  /** Ten chi so ("WBC"). Duoc chuan hoa ve CHU HOA khi luu - xem `LaboratoriesService`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  parameter: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  value: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  referenceMin?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  referenceMax?: number | null;

  /**
   * GHI DE co bat thuong. Bo trong = he thong tu tinh tu khoang tham chieu (truong hop
   * thuong gap). Truyen gia tri khi co ngoai le theo loai/tuoi, hoac de danh dau
   * `CRITICAL` - co nay khong bao gio tu sinh ra, xem `LabResultFlag`.
   */
  @IsOptional()
  @IsEnum(LabResultFlag)
  flag?: LabResultFlag;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
