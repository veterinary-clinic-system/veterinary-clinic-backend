import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
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

  /**
   * Ly do huy luot cho, chi co nghia khi `status = CANCELLED` (FR-05-04). Bo trong thi
   * he thong ghi "Khách bỏ về trước khi được khám" - luu vet khong duoc phep rong.
   */
  @IsOptional()
  @IsString({ message: 'Lý do hủy không hợp lệ' })
  @MaxLength(500, { message: 'Lý do hủy không được vượt quá 500 ký tự' })
  reason?: string;
}
