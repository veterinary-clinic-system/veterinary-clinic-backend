import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MedicationRoute } from '@/shared/common/enums/medication-route.enum';

/**
 * Mot dong thuoc trong `CreatePrescriptionDto.items` - day du bay truong FR-11-01.
 *
 * `quantity` la truong RIENG do bac si nhap chu khong suy ra tu `dosage` x `frequency`
 * x `durationDays`: hai truong kia la text tu do va co nhung y lenh khong quy ve mot
 * con so duoc ("khi sot tren 39 do"). Ma `quantity` lai la con so tru kho va tinh tien,
 * nen no phai la thu bac si co dinh, khong phai thu he thong doan.
 */
export class PrescriptionItemDto {
  @IsUUID()
  medicationId: string;

  /** So luong thuc cap, theo don vi cua thuoc (vien, ml, lo...). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity: number;

  /** Lieu moi lan, vi du "1 vien". */
  @IsString()
  @MaxLength(255)
  dosage: string;

  /** Tan suat, vi du "2 lan/ngay". */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  frequency?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  durationDays: number;

  @IsOptional()
  @IsEnum(MedicationRoute)
  route?: MedicationRoute;

  @IsOptional()
  @IsString()
  instructions?: string;
}
