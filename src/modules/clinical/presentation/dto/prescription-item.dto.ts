import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MedicationRoute } from '@/shared/common/enums/medication-route.enum';

export class PrescriptionItemDto {
  @IsUUID()
  medicationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity: number;

  @IsString()
  @MaxLength(255)
  dosage: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  frequency?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;

  @IsOptional()
  @IsEnum(MedicationRoute)
  route?: MedicationRoute;

  @IsOptional()
  @IsString()
  instructions?: string;
}
