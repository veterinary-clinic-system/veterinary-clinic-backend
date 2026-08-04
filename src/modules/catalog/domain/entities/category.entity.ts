import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';

/**
 * Danh muc hang hoa - SRS FR-14 (Service.Category), FR-15 (Medicine.Category),
 * FR-16 (Product.Category).
 *
 * MOT CAY DUNG CHUNG cho ca ba loai, khong phai ba bang rieng. SRS liet ke `Category`
 * o ca ba muc, nhung ba bang co cau truc y het nhau chi khac ten thi moi man hinh
 * quan tri, moi bo loc, moi truy van bao cao deu phai viet ba lan. `itemType` la thu
 * phan biet chung.
 *
 * `parentId` tu tham chieu de dung cay ("Thuc an" > "Thuc an hat"). Khong gioi han so
 * cap o tang du lieu - `CategoriesService` chan chu trinh (mot danh muc khong the la
 * to tien cua chinh no), con do sau bao nhieu la quyet dinh nghiep vu, khong phai luat
 * cua luoc do.
 */
@Entity({ name: 'categories' })
@Index(['itemType', 'parentId'])
export class Category extends BaseEntity {
  @Column({ name: 'category_name', length: 255 })
  categoryName: string;

  /**
   * Ma nghiep vu do nguoi dung dat (khac `id` la UUID). Unique trong pham vi cac danh
   * muc chua xoa mem - xem `uq_categories_code`.
   */
  @Column({ name: 'code', length: 64 })
  code: string;

  @ManyToOne(() => Category, (category) => category.children, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @Column({ name: 'parent_id', type: 'varchar', nullable: true })
  parentId: string | null;

  @OneToMany(() => Category, (category) => category.parent)
  children?: Category[];

  /**
   * Loai hang hoa danh muc nay phuc vu. Danh muc con BUOC PHAI cung `itemType` voi cha
   * (kiem trong service): mot danh muc san pham nam duoi mot danh muc dich vu thi bo
   * loc theo loai se tra ve mot cay cut nhanh.
   */
  @Column({ name: 'item_type', type: 'enum', enum: ItemType })
  itemType: ItemType;

  @Column({ name: 'active', default: true })
  active: boolean;
}
