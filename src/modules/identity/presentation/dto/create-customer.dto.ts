import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;

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
