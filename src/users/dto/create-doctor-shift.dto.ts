import { IsIn, IsInt, Matches } from 'class-validator';

/**
 * `dayOfWeek` follows JS `Date#getDay()` (0=Sunday...6=Saturday) but is restricted to
 * 1-5 (Mon-Fri): Section 5.1 mandates the clinic is closed Saturday/Sunday, so a shift
 * on those days would never produce a bookable slot.
 */
export class CreateDoctorShiftDto {
  @IsInt()
  @IsIn([1, 2, 3, 4, 5], {
    message:
      'dayOfWeek must be Monday (1) through Friday (5) - the clinic is closed Saturday/Sunday',
  })
  dayOfWeek: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime: string;
}
