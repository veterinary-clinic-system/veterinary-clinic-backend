import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Category } from './category.entity';
import { InventoryItem } from './inventory-item.entity';

/**
 * diagram.jpg `Item` box - the shared, priced, stockable catalog entry referenced by
 * both InvoiceItem (billing) and InventoryItem (per-branch stock). `Service` and
 * `Medication` (both added, see their own files) each extend one Item 1:1 with
 * domain-specific fields; `unitPrice` here is the current catalog/list price, while
 * InvoiceItem.price is a snapshot of the price actually charged at invoice time.
 */
@Entity({ name: 'items' })
export class Item extends BaseEntity {
  @Column({ name: 'item_name', length: 255 })
  itemName: string;

  /**
   * Ma nghiep vu (DV0001 / TH0001 / SP0001...) - SRS FR-14 Service.Code, FR-15
   * Medicine.Code. Dat o `Item` chu khong nhan ban xuong `services`/`medications`:
   * hai cot ma o hai bang con thi o tim "nhap ma hang" phai UNION hai bang.
   *
   * Do trigger `trg_assign_item_code` cap khi INSERT, khong nhan tu client - xem
   * migration `1791000002000-ItemCodeAndCategory.ts`.
   */
  @Column({ name: 'code', length: 32 })
  code: string;

  /** Danh muc (FR-16). Nullable: hang cu chua phan loai van phai ban duoc. */
  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'varchar', nullable: true })
  categoryId: string | null;

  @Column({ name: 'describe', type: 'text', nullable: true })
  describe: string | null;

  @Column({ type: 'enum', enum: ItemType, default: ItemType.OTHER })
  itemType: ItemType;

  /** Don gia tinh bang DONG (so nguyen) - Phan V.4 quyet dinh #2. */
  @Column({ name: 'unit_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  unitPrice: number;

  @Column({ name: 'active', default: true })
  active: boolean;

  @OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.item)
  invoiceItems?: InvoiceItem[];

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.item)
  inventoryItems?: InventoryItem[];
}
