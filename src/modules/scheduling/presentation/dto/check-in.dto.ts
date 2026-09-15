import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

export class CheckInDto {
  @IsUUID()
  appointmentId: string;

  @IsOptional()
  @IsEnum(PriorityColor)
  priorityColor?: PriorityColor;

  @IsOptional()
  @IsString()
  note?: string;
}
