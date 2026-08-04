import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { Specialization } from '@/shared/common/enums/specialization.enum';
import { ParseOptionalBoolean } from './transforms';

/**
 * PATCH /catalog/services/:id - every field optional. `itemName`/`describe`/`unitPrice`
 * belong to the backing Item row; `durationMinutes`/`requiresSpecialization` belong to
 * the Service row. Both are written in one transaction (services.service.ts `update()`).
 * `active` is a single flag applied to BOTH the Service row and its Item row so they
 * stay in sync - "is this service currently offered" is one concept for API consumers
 * even though it is stored in two tables.
 * Pass `null` for `describe` / `requiresSpecialization` to explicitly clear them.
 */
export class UpdateServiceDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(Specialization)
  requiresSpecialization?: Specialization | null;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;

  /** Danh muc (FR-15/FR-16) - nam tren `Item`. `null` de go khoi danh muc. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId?: string | null;
}
