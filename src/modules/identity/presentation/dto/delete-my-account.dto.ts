import { IsString, MinLength } from 'class-validator';

export class DeleteMyAccountDto {
  /** Nhập lại mật khẩu để chắc chắn chính chủ đang xoá. */
  @IsString({ message: 'Vui lòng nhập mật khẩu' })
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu' })
  password: string;
}
