import { IsIn, IsInt, Matches } from 'class-validator';

export class OperatingHourDto {
  @IsInt()
  @IsIn([1, 2, 3, 4, 5], {
    message:
      'dayOfWeek must be Monday (1) through Friday (5) - the clinic is closed Saturday/Sunday',
  })
  dayOfWeek: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime must be in HH:mm format' })
  openTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime must be in HH:mm format' })
  closeTime: string;
}
