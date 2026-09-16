import { IsPhoneNumber } from 'class-validator';

export class CreateBookingCheckoutDto {
  @IsPhoneNumber('VN')
  phone: string;
}
