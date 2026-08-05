import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

/** POST /billing/invoices/:id/refund - BR-14. */
export class RefundInvoiceDto {
  /**
   * BAT BUOC. Mot khoan hoan tien khong ly do la mot lo hong khong truy duoc - cung
   * nguyen tac voi `AdjustStockParams.note` cua kho (P6).
   */
  @IsString()
  @IsNotEmpty()
  reason: string;

  /** Bo trong = hoan toan bo so da thu. Dien so nho hon de hoan mot phan. */
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  /** Bo trong = hoan bang chinh phuong thuc da thu. */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

/** POST /billing/invoices/:id/cancel. */
export class CancelInvoiceDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
