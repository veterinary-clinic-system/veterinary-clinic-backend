import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';

export class LaboratoryResultDto {
  
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  parameter: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  value: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  referenceMin?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  referenceMax?: number | null;

  @IsOptional()
  @IsEnum(LabResultFlag)
  flag?: LabResultFlag;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
