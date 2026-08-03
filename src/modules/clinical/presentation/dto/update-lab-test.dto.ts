import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

/**
 * Result files are uploaded separately via `POST /files/upload?category=lab-results`
 * (owned by the files module) - this endpoint only accepts the resulting URL strings.
 */
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
