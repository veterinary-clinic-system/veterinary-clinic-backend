import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AppointmentStatus } from '@/common/enums/appointment-status.enum';
import { PriorityColor } from '@/common/enums/priority-color.enum';

/**
 * Receptionist/Doctor adjustments to an existing booking (Section 4.1.2: "Receptionist
 * can adjust bookings and must notify the owner, using a priority color label").
 * Any change here that touches `startAt`/`doctorId`/`status` triggers a re-validation
 * of slot availability and an owner notification from AppointmentsService.
 */
export class UpdateAppointmentDto {
  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsEnum(PriorityColor)
  priorityColor?: PriorityColor;

  @IsOptional()
  @IsString()
  notes?: string;
}
