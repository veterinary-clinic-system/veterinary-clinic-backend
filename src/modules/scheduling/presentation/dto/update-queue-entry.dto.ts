import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { QueueStatus } from '@/shared/common/enums/queue-status.enum';

/**
 * Cap nhat mot luot cho: day trang thai toi (WAITING -> ASSIGNED -> IN_ROOM -> DONE),
 * huy luot cho khi khach bo ve, hoac chinh muc uu tien / ghi chu.
 *
 * Khong the dat `doctorId` o day - gan bac si di kem viec tao/doi lich hen nen co
 * endpoint rieng `PATCH /queue/:id/assign`.
 */
export class UpdateQueueEntryDto {
  @IsOptional()
  @IsEnum(QueueStatus)
  status?: QueueStatus;

  @IsOptional()
  @IsEnum(PriorityColor)
  priorityColor?: PriorityColor;

  @IsOptional()
  @IsString()
  note?: string;
}
