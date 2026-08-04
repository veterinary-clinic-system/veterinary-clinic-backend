import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from './item.entity';

/**
 * Hang hoa ban le - SRS FR-16.
 *
 * Mo rong `Item` 1:1 y het cach `Service` va `Medication` dang lam. Khong dung bang
 * gia song song: neu `products` co cot gia ban rieng thi POS va Invoice se phai xu ly
 * hai nguon gia va moi bao cao doanh thu se phai UNION - no ky thuat khong dang.
 *
 * GIA BAN o `items.unit_price`; `costPrice` (gia von) o day vi chi HANG HOA moi co gia
 * von - mot lan kham khong co "gia nhap". Cung ly do voi `minimumStock`.
 */
@Entity({ name: 'products' })
export class Product extends BaseEntity {
  @OneToOne(() => Item, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  /**
   * Ma vach/ma kho cua nha san xuat. Khac `items.code` (ma noi bo do he thong sinh):
   * `sku` la cai doc duoc tu vo hop, va NFR-02 liet ke dich danh no trong cac truong
   * phai tim kiem nhanh.
   */
  @Index('idx_products_sku')
  @Column({ name: 'sku', length: 64 })
  sku: string;

  @Column({ name: 'brand', type: 'varchar', length: 255, nullable: true })
  brand: string | null;

  /** Don vi ban ("hop", "goi", "chai"...). */
  @Column({ name: 'unit', length: 50 })
  unit: string;

  /** Gia von tinh bang DONG (so nguyen) - Phan V.4 quyet dinh #2. */
  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  /** Nguong canh bao sap het hang. P6 se dung de sinh thong bao nhap hang. */
  @Column({ name: 'minimum_stock', type: 'int', default: 0 })
  minimumStock: number;

  @Column({ name: 'active', default: true })
  active: boolean;
}
