import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * `POST /catalog/stock-takes` - SRS FR-18-03.
 *
 * `inventoryItemIds` bo trong = kiem ke TOAN BO mat hang dang co ton o chi nhanh. Do la
 * truong hop thuong gap (kiem ke dinh ky), nen no la mac dinh; liet ke ra dung khi chi
 * dem mot nhom hang.
 *
 * KHONG nhan `systemQuantity` tu client: so he thong do server chup tai thoi diem tao
 * phieu, nhan tu client thi nguoi dung tu quyet dinh duoc chenh lech la bao nhieu.
 */
export class CreateStockTakeDto {
  @IsUUID()
  branchId: string;

  /** `YYYY-MM-DD`. Bo trong thi lay ngay hom nay. */
  @IsOptional()
  @IsISO8601()
  takenDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  inventoryItemIds?: string[];
}

export class CountStockTakeItemDto {
  @IsUUID()
  stockTakeItemId: string;

  /** So dem thuc te. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedQuantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** `PATCH /catalog/stock-takes/:id/counts` - nhap so dem cho nhieu dong mot luot. */
export class SubmitStockTakeCountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CountStockTakeItemDto)
  items: CountStockTakeItemDto[];
}

/** `POST /catalog/stock-takes/:id/confirm`. */
export class ConfirmStockTakeDto {
  /** Ly do chung, di vao `note` cua cac dong so cai khong co ly do rieng. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
