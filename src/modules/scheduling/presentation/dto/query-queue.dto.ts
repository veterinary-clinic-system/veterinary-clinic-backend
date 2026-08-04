import { IsArray, IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { QueueStatus } from '@/shared/common/enums/queue-status.enum';

/**
 * Bo loc man hinh hang cho. Bo trong `date` = hang cho HOM NAY (truong hop dung
 * gan nhu 100% thoi gian tai quay).
 *
 * `status` nhan nhieu gia tri: `?status=WAITING&status=ASSIGNED` hoac `?status=WAITING,ASSIGNED`.
 * Bo trong = chi lay cac luot cho CON HOAT DONG (WAITING/ASSIGNED/IN_ROOM), vi man hinh
 * quay le tan khong muon thay lai nhung ca da xong tu sang.
 */
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

  // Doc `obj[key]` (chuoi tho) chu khong doc `value`, vi `enableImplicitConversion`
  // trong main.ts chay truoc @Transform - xem ghi chu chi tiet o query-customers.dto.ts.
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
