import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

export class RefundInvoiceDto {
  
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class CancelInvoiceDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
