import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Bac si nghi dot xuat ca ngay (om, viec gia dinh...).
 *
 * `reassign` mac dinh BAT: muc dich cua thao tac nay la don sach lich trong ngay, khong
 * phai chi de danh dau nghi. Tat no de xem truoc anh huong ma chua dong vao lich hen -
 * khi do ban ghi nghi VAN duoc tao, chi la khong ca nao bi doi bac si.
 */
export class DoctorAbsenceDto {
  @IsUUID(undefined, { message: 'Bác sĩ không hợp lệ' })
  doctorId: string;

  /** 'yyyy-MM-dd'. */
  @IsDateString({}, { message: 'Ngày nghỉ không hợp lệ' })
  date: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @Transform(({ value }) => value !== false && value !== 'false')
  @IsBoolean()
  reassign?: boolean;
}
