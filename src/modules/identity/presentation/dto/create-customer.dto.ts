import {
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
  @IsPhoneNumber('VN')
  phone: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
