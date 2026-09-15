import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ParseOptionalBoolean } from './transforms';

export class UpdateInventoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  inventoryQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  delta?: number;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
