import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

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

  // ------------------------------------------------------------------ P5-T4 (FR-15)

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Ten goc (INN) - khac `activeIngredient`: "Paracetamol" so voi "Panadol". */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  genericName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  manufacturer?: string;

  /** Chi la GOI Y cho don nhap hang o P6, khong phai rang buoc. */
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  /** Gia von, don vi DONG. Duoc phep lon hon `unitPrice` - co nghiep vu ban lo that. */
  @IsOptional()
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;
}
