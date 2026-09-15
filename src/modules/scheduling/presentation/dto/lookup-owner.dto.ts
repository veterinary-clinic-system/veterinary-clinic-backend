import { IsPhoneNumber } from 'class-validator';

export class LookupOwnerDto {
  @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ' })
  phone: string;
}
