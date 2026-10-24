import { IsString, Matches, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString({ message: 'Vui lòng nhập số điện thoại' })
  @MinLength(9, { message: 'Số điện thoại không hợp lệ' })
  phone: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Vui lòng nhập số điện thoại' })
  @MinLength(9, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @IsString()
  @Matches(/^\s*\d{6}\s*$/, { message: 'Mã xác nhận gồm 6 chữ số' })
  code: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự' })
  newPassword: string;
}
