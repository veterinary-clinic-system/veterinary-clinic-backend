import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';

/** PATCH /catalog/diseases/:id - every field optional. Pass `null` to clear `otherSymptoms`. */
export class UpdateDiseaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  diseaseName?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CommonSymptom, { each: true })
  commonSymptoms?: CommonSymptom[];

  @IsOptional()
  @IsString()
  otherSymptoms?: string | null;
}
