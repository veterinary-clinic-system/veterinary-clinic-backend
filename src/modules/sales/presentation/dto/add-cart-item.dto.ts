import { IsInt, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class SetCartItemQuantityDto {
  @IsInt()
  @Min(1)
  quantity: number;
}
