import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { StockTakeStatus } from '@/shared/common/enums/stock-take-status.enum';

/** `GET /catalog/stock-takes`. */
export class QueryStockTakesDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(StockTakeStatus)
  status?: StockTakeStatus;

  /** Tim theo ma phieu. */
  @IsOptional()
  @IsString()
  search?: string;
}
