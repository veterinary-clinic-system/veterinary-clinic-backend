import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Le tan them mot khach hang moi ngoai luong dat lich.
 *
 * `password` la TUY CHON co chu dich: rat nhieu khach chi den quay, khong bao gio dang
 * nhap. Bo trong thi `passwordHash` la null - dung co che ma `AppointmentsService`
 * da dung khi tu tao tai khoan PET_OWNER cho khach dat lich lan dau. Khach co the
 * dat mat khau sau qua luong dang ky binh thuong.
 */
export class CreateCustomerDto {
  @IsPhoneNumber('VN', { message: 'Số điện thoại không đúng định dạng Việt Nam' })
  phone: string;

  @IsString({ message: 'Vui lòng nhập họ tên khách hàng' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(255, { message: 'Họ tên không được vượt quá 255 ký tự' })
  fullName: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Mật khẩu không hợp lệ' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password?: string;

  /** Ngay sinh khach hang (FR-03-01), dinh dang `YYYY-MM-DD`. */
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  dateOfBirth?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ không hợp lệ' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  note?: string;
}
