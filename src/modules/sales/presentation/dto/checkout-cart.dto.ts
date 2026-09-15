import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

export class CheckoutCartDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountPaid?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  referenceCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
