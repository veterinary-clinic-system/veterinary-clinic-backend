import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';

export class QueryStaffNotificationsDto extends PaginationQueryDto {
  
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.unreadOnly === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}
