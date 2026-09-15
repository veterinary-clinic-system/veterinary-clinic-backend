import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PrescriptionItemDto } from './prescription-item.dto';

export class CreatePrescriptionDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}

export class CreateStandalonePrescriptionDto extends CreatePrescriptionDto {
  @IsUUID()
  medicalRecordId: string;
}
