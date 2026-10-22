import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsNotFutureDate } from '@/shared/common/validation/is-not-future-date.validator';

/** Chủ nuôi tự sửa hồ sơ. Số điện thoại là tên đăng nhập nên không đổi ở đây. */
export class UpdateMyProfileDto {
  @IsOptional()
  @IsString({ message: 'Vui lòng nhập họ tên' })
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự' })
  @MaxLength(255, { message: 'Họ tên không được vượt quá 255 ký tự' })
  fullName?: string;

  /** Chuỗi rỗng hoặc null = bỏ email. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  @IsNotFutureDate({ message: 'Ngày sinh không được sau hôm nay' })
  dateOfBirth?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString({ message: 'Địa chỉ không hợp lệ' })
  @MaxLength(500, { message: 'Địa chỉ không được vượt quá 500 ký tự' })
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;
}
