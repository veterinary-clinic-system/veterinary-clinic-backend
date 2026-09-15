import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ParseOptionalBoolean } from './transforms';

export class UpdateVaccineDto {
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
  @MaxLength(255)
  diseasePrevented?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  speciesIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  doseCount?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  intervalDays?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  boosterIntervalDays?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;

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

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;
}
