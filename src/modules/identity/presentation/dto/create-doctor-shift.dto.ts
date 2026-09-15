import { IsIn, IsInt, Matches } from 'class-validator';

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
