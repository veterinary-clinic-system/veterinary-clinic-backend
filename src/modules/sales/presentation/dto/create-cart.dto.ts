import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCartDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
