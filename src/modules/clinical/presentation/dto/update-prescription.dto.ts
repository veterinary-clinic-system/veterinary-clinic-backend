import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PrescriptionItemDto } from './prescription-item.dto';

/**
 * `PATCH /prescriptions/:id` - chi lam duoc khi don con `PRESCRIBED` (P7-T2).
 *
 * `items` neu co thi THAY THE toan bo cac dong, cung quy uoc voi don dat hang o P6: mot
 * don thuoc la mot y lenh tron ven, sua no la sua ca ban chu khong va tung dong.
 */
export class UpdatePrescriptionDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items?: PrescriptionItemDto[];
}
