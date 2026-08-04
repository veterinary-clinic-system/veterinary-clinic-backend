import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ItemType } from '@/shared/common/enums/item-type.enum';

/**
 * `POST /catalog/categories` - SRS FR-16.
 *
 * `itemType` bat buoc va KHONG sua duoc sau khi tao (xem `UpdateCategoryDto`): doi loai
 * cua mot danh muc dang chua hang se lam moi mon hang trong do roi ra ngoai bo loc.
 */
export class CreateCategoryDto {
  @IsString()
  @MaxLength(255)
  categoryName: string;

  @IsString()
  @MaxLength(64)
  code: string;

  @IsEnum(ItemType)
  itemType: ItemType;

  /** Bo trong = danh muc goc. Danh muc cha phai cung `itemType`. */
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
