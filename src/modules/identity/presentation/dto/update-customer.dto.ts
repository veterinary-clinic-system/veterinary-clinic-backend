import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * `phone` va `role` khong duoc khai bao o day co chu dich (giong `UpdateUserDto`):
 * so dien thoai la dinh danh dang nhap va la khoa tra cuu cua khach tai quay, doi no
 * la thao tac "tao ho so moi". `ValidationPipe({ whitelist: true })` toan cuc da loai
 * bo moi truong thua ma client co gang gui kem.
 */
export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
