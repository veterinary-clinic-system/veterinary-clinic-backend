import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';

/** POST /pos/carts/:id/checkout - UC-04. */
export class CheckoutCartDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  /**
   * So tien khach dua. Bo trong = tra du.
   *
   * Cho phep tra thieu (hoa don ve `PARTIALLY_PAID`) vi ban chiu mot phan cho khach quen
   * la co that o cua hang nho; tra DU thi bi tu choi 409 - phan thua la tien thoi lai,
   * khong phai doanh thu (xem `PaymentsService.record`).
   */
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
