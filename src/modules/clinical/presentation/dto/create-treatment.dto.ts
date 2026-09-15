import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTreatmentDto {
  @IsString()
  @MaxLength(255)
  method: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
