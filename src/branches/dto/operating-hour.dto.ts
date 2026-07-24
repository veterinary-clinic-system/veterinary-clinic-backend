import { IsIn, IsInt, Matches } from 'class-validator';

/**
 * One row of a branch's weekly schedule, used as the array-item type for
 * `PUT /branches/:id/opening-hours` (the request body is a raw JSON array of these).
 * `dayOfWeek` follows JS `Date#getDay()` (0=Sunday...6=Saturday) but is restricted to
 * 1-5 (Mon-Fri) - Section 5.1 mandates the clinic is closed Saturday/Sunday.
 */
export class OperatingHourDto {
  @IsInt()
  @IsIn([1, 2, 3, 4, 5], {
    message: 'dayOfWeek must be Monday (1) through Friday (5) - the clinic is closed Saturday/Sunday',
  })
  dayOfWeek: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime must be in HH:mm format' })
  openTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime must be in HH:mm format' })
  closeTime: string;
}
