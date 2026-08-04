import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * `phone` va `role` khong duoc khai bao o day co chu dich (giong `UpdateUserDto`):
 * so dien thoai la dinh danh dang nhap va la khoa tra cuu cua khach tai quay, doi no
 * la thao tac "tao ho so moi". `ValidationPipe({ whitelist: true })` toan cuc da loai
 * bo moi truong thua ma client co gang gui kem.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString({ message: 'Vui lòng nhập họ tên khách hàng' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(255, { message: 'Họ tên không được vượt quá 255 ký tự' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  dateOfBirth?: string;

  @IsOptional()
  @IsString({ message: 'Địa chỉ không hợp lệ' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  note?: string;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động không hợp lệ' })
  active?: boolean;
}
