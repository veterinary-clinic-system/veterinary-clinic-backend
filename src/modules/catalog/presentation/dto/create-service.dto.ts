import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Specialization } from '@/shared/common/enums/specialization.enum';

/**
 * POST /catalog/services body. `unitPrice`/`itemName`/`describe` live on the backing
 * `Item` row (created alongside the `Service` row in one transaction) - see
 * CatalogService (services.service.ts) `create()`.
 */
export class CreateServiceDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes: number;

  /** Which Doctor.specialization this service requires, if any (free-text match, not FK-enforced). */
  @IsOptional()
  @IsEnum(Specialization)
  requiresSpecialization?: Specialization;
}
