import { IsOptional, IsUUID } from 'class-validator';

export class QueryPublicVaccinesDto {
  @IsOptional()
  @IsUUID(undefined, { message: 'Loài không hợp lệ' })
  speciesId?: string;
}
