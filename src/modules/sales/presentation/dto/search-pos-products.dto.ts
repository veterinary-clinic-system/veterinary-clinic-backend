import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/** `GET /pos/products` - o tim san pham cua man hinh POS (SRS muc 12.5). */
export class SearchPosProductsDto {
  @IsUUID()
  branchId: string;

  /** Khop gan dung theo ten / ma mat hang / SKU (may quet ma vach nhap vao day). */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Man hinh POS hien mot luoi ngan, khong phan trang: nhan vien go them vai chu de thu
   * hep chu khong bam sang trang hai. Tran 100 de mot lan go hut cong khong keo ca danh
   * muc ve may.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
