import { IsEnum } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

export class PayInvoiceDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
