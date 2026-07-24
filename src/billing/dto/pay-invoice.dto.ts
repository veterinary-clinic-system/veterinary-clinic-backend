import { IsEnum } from 'class-validator';
import { PaymentMethod } from '@/common/enums/payment-method.enum';

export class PayInvoiceDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
