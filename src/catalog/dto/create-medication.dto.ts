import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/**
 * POST /catalog/medications body. `unitPrice`/`itemName`/`describe` live on the backing
 * `Item` row (created alongside the `Medication` row in one transaction) - see
 * medications.service.ts `create()`.
 */
export class CreateMedicationDto {
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

  /** Dosage unit, e.g. "tablet", "ml", "vial". */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unit: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  activeIngredient?: string;
}
