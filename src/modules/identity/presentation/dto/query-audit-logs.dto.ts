import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

/**
 * GET /audit-logs - trang xem nhat ky kiem toan (P10-T2).
 *
 * `action` va `entityName` la chuoi tu do chu khong phai enum: cot tuong ung o CSDL la
 * `varchar` va da co the chua gia tri tu truoc P10 (hoac tu mot phien ban sau nay them
 * loai moi). Rang buoc bang enum o day se lam bo loc khong go duoc chinh nhung dong dang
 * nam trong bang.
 */
export class QueryAuditLogsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityName?: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  /** `YYYY-MM-DD`, bao gom ca ngay nay. */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
