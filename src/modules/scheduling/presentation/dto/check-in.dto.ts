import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

/**
 * Le tan xac nhan "khach da den" cho mot lich hen da dat truoc: lich hen chuyen sang
 * CHECKED_IN va mot luot cho duoc mo cho khach.
 */
export class CheckInDto {
  @IsUUID()
  appointmentId: string;

  /** Le tan co the nang/ha muc uu tien ngay tai quay khi nhin thay tinh trang con vat. */
  @IsOptional()
  @IsEnum(PriorityColor)
  priorityColor?: PriorityColor;

  @IsOptional()
  @IsString()
  note?: string;
}
