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

/**
 * `POST /prescriptions` - cua vao MOI cua P7-T5, ke don thang vao mot ho so benh an.
 *
 * Khac `POST /examinations/:id/prescriptions` (cua vao cu, van giu cho giao dien hien
 * co) o dung mot cho: ho so duoc chi dinh trong than request thay vi suy ra tu id phieu
 * kham. Ke thua thay vi nhan ban de hai duong vao khong bao gio lech nhau ve luat.
 */
export class CreateStandalonePrescriptionDto extends CreatePrescriptionDto {
  @IsUUID()
  medicalRecordId: string;
}
