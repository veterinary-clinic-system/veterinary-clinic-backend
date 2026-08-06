import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

export class QueryStaffNotificationsDto extends PaginationQueryDto {
  /**
   * Doc `obj[key]` (chuoi tho) chu KHONG phai `value`: `enableImplicitConversion` trong
   * `main.ts` chay truoc va da bien chuoi "false" thanh `true`. Mau lay tu
   * `query-customers.dto.ts`.
   */
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.unreadOnly === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}
