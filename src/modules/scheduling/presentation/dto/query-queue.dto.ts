import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { QueueStatus } from '@/shared/common/enums/queue-status.enum';

export class QueryQueueDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = obj?.[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    return (Array.isArray(raw) ? raw : String(raw).split(',')).map((v) => String(v).trim());
  })
  @IsArray()
  @IsEnum(QueueStatus, { each: true })
  status?: QueueStatus[];
}
