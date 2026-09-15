import {
  IsArray,
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Doctor's exam-entry form (Section 4.1.4: "record actual symptoms, vital signs, and
 * the formal diagnosis"). One Examination per Appointment - service throws
 * ConflictException if one already exists, directing the caller to PATCH instead.
 */
export class CreateExaminationDto {
  @IsUUID()
  appointmentId: string;

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
