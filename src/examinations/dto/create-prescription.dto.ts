import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PrescriptionItemDto } from './prescription-item.dto';

/** Section 4.1.4: "Prescribe medication: dosage, number of days" - one Prescription per submit. */
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
