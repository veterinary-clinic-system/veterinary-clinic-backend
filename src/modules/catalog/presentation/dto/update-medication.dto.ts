import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ParseOptionalBoolean } from './transforms';

/**
 * PATCH /catalog/medications/:id - every field optional. `itemName`/`describe`/
 * `unitPrice` belong to the backing Item row; `unit`/`activeIngredient` belong to the
 * Medication row. Both are written in one transaction (medications.service.ts
 * `update()`). `active` is applied to BOTH rows, same reasoning as UpdateServiceDto.
 * Pass `null` for `describe` / `activeIngredient` to explicitly clear them.
 */
export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;

  @IsOptional()
  @IsString()
  describe?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  activeIngredient?: string | null;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;

  // ------------------------------------------------------------------ P5-T4 (FR-15)

  /** Danh muc (FR-15/FR-16) - nam tren `Item`. `null` de go khoi danh muc. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  supplierId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;
}
