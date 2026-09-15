import { IsBoolean, IsOptional, Matches } from 'class-validator';

/** `PATCH /users/doctors/shifts/:shiftId` - update times and/or toggle `active`. */
export class UpdateDoctorShiftDto {
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:mm format' })
  endTime?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
