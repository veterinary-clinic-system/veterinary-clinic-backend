import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { CartStatus } from '@/shared/common/enums/cart-status.enum';

/** `GET /pos/carts` - man hinh POS dung de lay lai gio dang do cua quay. */
export class QueryCartsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(CartStatus)
  status?: CartStatus;

  @IsOptional()
  @IsUUID()
  staffUserId?: string;
}
