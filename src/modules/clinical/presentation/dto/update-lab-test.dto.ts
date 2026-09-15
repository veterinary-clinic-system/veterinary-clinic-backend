import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

export class UpdateLabTestDto {
  @IsOptional()
  @IsEnum(LabTestStatus)
  status?: LabTestStatus;

  @IsOptional()
  @IsString()
  resultText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resultFileUrls?: string[];
}
