import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { QueueStatus } from '@/shared/common/enums/queue-status.enum';

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

    @IsOptional()
  @IsString({ message: 'Lý do hủy không hợp lệ' })
  @MaxLength(500, { message: 'Lý do hủy không được vượt quá 500 ký tự' })
  reason?: string;
}
