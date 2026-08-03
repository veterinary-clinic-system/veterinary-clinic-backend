import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** One prescribed medication line within CreatePrescriptionDto.items. */
export class PrescriptionItemDto {
  @IsUUID()
  medicationId: string;

  /** e.g. "1 tablet twice a day" - human-readable dosage instruction. */
  @IsString()
  dosage: string;

  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;

  @IsOptional()
  @IsString()
  instructions?: string;
}
