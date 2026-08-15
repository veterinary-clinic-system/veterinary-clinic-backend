import { IsPhoneNumber } from 'class-validator';

/** Tham so cua `GET /appointments/owner-lookup` - bieu mau dat lich cong khai. */
export class LookupOwnerDto {
  @IsPhoneNumber('VN', { message: 'Số điện thoại không hợp lệ' })
  phone: string;
}
