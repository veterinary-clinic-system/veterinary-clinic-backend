import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Backs both the public free/busy widget and the staff calendar (Section 5.2: "jump to
 * a specific date and see the week that contains it"). `weekOf` is any date inside the
 * target week; AvailabilityService resolves it to that week's Monday.
 */
export class QueryWeekDto {
  @IsUUID()
  branchId: string;

  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsDateString()
  weekOf?: string;
}
