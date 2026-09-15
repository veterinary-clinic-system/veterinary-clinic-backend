import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LaboratoryResultDto } from './laboratory-result.dto';

export class SaveLaboratoryResultsDto {
  @IsArray()

  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LaboratoryResultDto)
  results: LaboratoryResultDto[];

  @IsOptional()
  @IsDateString()
  resultDate?: string;

  @IsOptional()
  @IsString()
  resultText?: string;
}
