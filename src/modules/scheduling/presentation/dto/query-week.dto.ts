import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class QueryWeekDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @IsDateString()
  weekOf?: string;
}
