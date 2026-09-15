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
  IsUUID,
} from 'class-validator';
import { Specialization } from '@/shared/common/enums/specialization.enum';

export class CreateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

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

  @IsOptional()
  @IsEnum(Specialization)
  requiresSpecialization?: Specialization;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
