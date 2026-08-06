import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * POST /catalog/vaccines - SRS FR-12 (P9-T1).
 *
 * `itemName` / `describe` / `unitPrice` / `categoryId` thuoc dong `Item` di kem, duoc
 * tao trong cung transaction - xem `vaccines.service.ts` `create()`.
 */
export class CreateVaccineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  itemName: string;

  @IsOptional()
  @IsString()
  describe?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  /** Benh phong ngua - FR-12. Bat buoc: mot vaccine khong noi ro phong benh gi thi bac si khong chon duoc. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  diseasePrevented: string;

  /** Loai ap dung. Bo trong / mang rong = dung cho moi loai (vd vaccine dai). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  speciesIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  doseCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  boosterIntervalDays?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;
}
