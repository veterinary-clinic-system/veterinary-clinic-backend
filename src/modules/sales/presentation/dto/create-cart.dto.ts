import { IsOptional, IsString, IsUUID } from 'class-validator';

/** POST /pos/carts - mo mot gio hang moi tai quay. */
export class CreateCartDto {
  @IsUUID()
  branchId: string;

  /** Bo trong = khach vang lai. Xem comment dau `Cart`. */
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
