import { IsDateString, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateTreatmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  method?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
