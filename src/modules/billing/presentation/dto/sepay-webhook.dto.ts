import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Than webhook do SePay gui khi tai khoan ngan hang co bien dong so du.
 *
 * Cac truong theo tai lieu webhook cua SePay. CO Y de phan lon la tuy chon: day la du
 * lieu cua ben thu ba, va mot truong phu doi ten o phia ho khong duoc phep lam ca cua
 * webhook tra ve 400 (SePay se coi la that bai va gui lai mai).
 *
 * Ba truong that su can: `id` (chong ghi trung), `transferType` (chi tinh tien VAO) va
 * `transferAmount` (so tien).
 */
export class SepayWebhookDto {
  /** Ma giao dich phia SePay - dung lam khoa chong ghi trung. */
  @Type(() => String)
  @IsString()
  id: string;

  /** 'in' = tien vao, 'out' = tien ra. Chi 'in' duoc tinh la thanh toan. */
  @IsIn(['in', 'out'])
  transferType: 'in' | 'out';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  transferAmount: number;

  /** Noi dung chuyen khoan - noi chua ma hoa don. */
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  /** Ten ngan hang, vi du 'MBBank'. */
  @IsOptional()
  @IsString()
  gateway?: string;

  /** Ma tham chieu cua ngan hang - luu de ke toan doi soat sao ke. */
  @IsOptional()
  @IsString()
  referenceCode?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  transactionDate?: string;
}
