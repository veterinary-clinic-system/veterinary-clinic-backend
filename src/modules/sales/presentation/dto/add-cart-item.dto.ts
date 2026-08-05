import { IsInt, IsUUID, Min } from 'class-validator';

/** POST /pos/carts/:id/items - them mon vao gio (cong don neu da co). */
export class AddCartItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

/** PATCH /pos/carts/:id/items/:itemId - dat lai so luong mot dong. */
export class SetCartItemQuantityDto {
  @IsInt()
  @Min(1)
  quantity: number;
}
