import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

/**
 * One-off unavailability carved out of a doctor's recurring `DoctorShift` (a lunch
 * overrun, a sick day, vacation) - `POST /users/doctors/:id/breaks`.
 */
export class CreateDoctorBreakDto {
  @IsDateString()
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
