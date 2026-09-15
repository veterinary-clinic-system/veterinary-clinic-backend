import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateVaccinationDto {
  @IsUUID()
  petId: string;

  @IsUUID()
  vaccineId: string;

  @IsOptional()
  @IsUUID()
  medicalRecordId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  vaccinatedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  doseNumber?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  nextDueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
