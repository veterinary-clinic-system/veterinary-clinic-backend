import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';

export class CreateDiseaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  diseaseName: string;

  @IsOptional()
  @IsArray()
  @IsEnum(CommonSymptom, { each: true })
  commonSymptoms?: CommonSymptom[];

  @IsOptional()
  @IsString()
  otherSymptoms?: string;
}
