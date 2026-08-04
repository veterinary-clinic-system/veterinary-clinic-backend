import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

/**
 * `?flag=true|1` -> true, `?flag=false|0` -> false, thieu -> undefined (khong loc).
 *
 * CO Y doc `obj[key]` (chuoi tho tu query string) chu KHONG doc `value`: `main.ts` bat
 * `transformOptions.enableImplicitConversion`, va class-transformer chay buoc ep kieu
 * ngam TRUOC @Transform. Voi mot thuoc tinh khai bao kieu boolean, no bien MOI chuoi
 * khac rong - ke ca "false" - thanh `true`, nen `?active=false` se im lang tro thanh
 * `?active=true`. Doc thang tu `obj` la di truoc buoc ep kieu do.
 */
function toOptionalBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }) {
  const raw = obj?.[key];
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  return raw === 'true' || raw === '1';
}

/** Bo loc cua man hinh danh sach khach hang (tim kiem + loc + phan trang + sap xep). */
export class QueryCustomersDto extends PaginationQueryDto {
  /** Khop gan dung theo ho ten / so dien thoai / email. */
  @IsOptional()
  @IsString()
  search?: string;

  /** true = dang hoat dong, false = da ngung hoat dong, bo trong = tat ca. */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  active?: boolean;

  /** true = chi khach DA co thu cung, false = chi khach CHUA co thu cung nao. */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  hasPets?: boolean;

  /** Chi lay khach tung co lich hen tai chi nhanh nay. */
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /** Loc theo ngay tao ho so (bao gom ca hai dau mut). */
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
