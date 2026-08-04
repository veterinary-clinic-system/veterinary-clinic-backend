import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Mo ho so benh an cho mot lich hen - `POST /medical-records`.
 *
 * Khong co `doctorId`: bac si chiu trach nhiem ho so duoc suy ra tu nguoi dang dang
 * nhap (BR-07), khong nhan tu client - de client tu khai thi mot bac si co the ghi ho
 * so dung ten dong nghiep.
 *
 * Ba truong noi dung deu tuy chon: man hinh kham (UC-03) mo ho so NGAY luc bac si bam
 * "Phieu kham", truoc khi hoi benh xong, roi PATCH dan trong luc kham.
 */
export class OpenMedicalRecordDto {
  @IsUUID()
  appointmentId: string;

  @IsOptional()
  @IsString()
  visitReason?: string;

  @IsOptional()
  @IsString()
  generalCondition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
