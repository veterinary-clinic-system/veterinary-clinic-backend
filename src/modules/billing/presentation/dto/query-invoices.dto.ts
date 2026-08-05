import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { InvoiceSource } from '@/shared/common/enums/invoice-source.enum';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';

/**
 * `?flag=true|1` -> true, `?flag=false|0` -> false, thieu -> undefined (khong loc).
 *
 * CO Y doc `obj[key]` chu KHONG doc `value` - xem giai thich day du o
 * `query-customers.dto.ts`: `enableImplicitConversion` chay TRUOC @Transform va bien
 * chuoi "false" thanh `true`. Ban truoc cua DTO nay doc `value` va dinh dung loi do:
 * `?paid=false` im lang tro thanh `?paid=true`.
 */
function toOptionalBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }) {
  const raw = obj?.[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return raw === 'true' || raw === '1';
}

/** Bo loc cua `GET /billing/invoices` - P8-T7. */
export class QueryInvoicesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** `CLINIC` = hoa don kham, `POS` = ban le tai quay. */
  @IsOptional()
  @IsEnum(InvoiceSource)
  source?: InvoiceSource;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Loc theo ngay LAP hoa don, `YYYY-MM-DD`, tinh ca ngay nay. */
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;

  /** Tim theo ma hoa don (`HD000123`). */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Giu lai tu truoc P8 cho cac man hinh cu. `?status=` la cach loc chinh xac hon:
   * `paid=false` gom ca hoa don da tra mot phan lan hoa don da huy.
   */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  paid?: boolean;
}
