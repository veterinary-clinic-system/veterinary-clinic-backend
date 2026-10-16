import { IsArray, IsNumber, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Same editable fields as CreateExaminationDto minus the immutable appointmentId/doctorId. */
export class UpdateExaminationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  diseaseGroups?: string[];

  @IsOptional()
  @IsString()
  diagnosisText?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(50)
  temperatureCelsius?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(400)
  heartRateBpm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  respiratoryRateBpm?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}
