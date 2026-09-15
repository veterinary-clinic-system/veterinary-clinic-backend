import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
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
}
