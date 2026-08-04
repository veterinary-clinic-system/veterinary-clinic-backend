import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ParseOptionalBoolean } from './transforms';

/** `GET /catalog/products` - tim theo ten / SKU / ma, loc theo danh muc + trang thai. */
export class QueryProductsDto extends PaginationQueryDto {
  /** Doi chieu voi ten san pham, SKU va ma noi bo cung mot luc. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;
}
