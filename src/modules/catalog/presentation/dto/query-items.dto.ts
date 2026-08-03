import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { ParseOptionalBoolean } from './transforms';

/**
 * Backs the public price-list read (`GET /catalog/items`). `active` defaults to true
 * when the query param is omitted - this route is `@Public()`, and `JwtAuthGuard`
 * short-circuits to `true` for public routes without ever running the passport 'jwt'
 * strategy (see JwtAuthGuard.canActivate), so `request.user` is never populated here
 * even if a caller sends a Bearer token. There is therefore no reliable way to detect
 * "authenticated" on this route; callers that need inactive rows too (e.g. an admin
 * screen reusing this endpoint) pass `active=false` explicitly.
 */
export class QueryItemsDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ItemType)
  itemType?: ItemType;

  @IsOptional()
  @ParseOptionalBoolean()
  @IsBoolean()
  active?: boolean;
}
