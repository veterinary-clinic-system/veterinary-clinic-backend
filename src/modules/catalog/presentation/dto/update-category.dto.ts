import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

/**
 * `PATCH /catalog/categories/:id`.
 *
 * KHONG co `itemType`: doi loai cua mot danh muc dang chua hang se lam moi mon hang
 * trong do roi ra ngoai bo loc, va lam ca nhanh con tro nen khong nhat quan voi cha.
 * Doi loai = tao danh muc moi roi chuyen hang sang.
 *
 * `parentId` nhan `null` mot cach co nghia: dua mot danh muc con len lam danh muc goc.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  categoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
