import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';

/**
 * Bo loc cua `GET /payments` - P8-T7, SRS muc 15.
 *
 * Man hinh doi soat cuoi ca can dung ba bo loc nay: theo NGAY (ca truc), theo PHUONG THUC
 * (dem tien mat trong ket so voi so may tinh), va theo TRANG THAI (tach cac dong hoan
 * tien ra khoi doanh thu).
 */
export class QueryPaymentsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  /** Nhan vien thu tien - de doi soat theo ca truc. */
  @IsOptional()
  @IsUUID()
  receivedByUserId?: string;

  /** Loc theo `paid_at`, `YYYY-MM-DD`, tinh ca ngay nay. */
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;
}
