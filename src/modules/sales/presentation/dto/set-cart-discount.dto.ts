import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * PATCH /pos/carts/:id/discount - P8-T6.
 *
 * Gui MOT trong hai: `amount` (so tien) hoac `percent` (phan tram). Gui ca hai, hoac
 * khong gui gi, deu la 400 - hai nguon giam gia cung luc thi khong ai doan duoc so cuoi.
 * Dat `amount = 0` de bo giam gia.
 */
export class SetCartDiscountDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent?: number;

  /** Ly do giam gia - hien tren man hinh POS va di vao audit log o P10. */
  @IsOptional()
  @IsString()
  note?: string;
}
