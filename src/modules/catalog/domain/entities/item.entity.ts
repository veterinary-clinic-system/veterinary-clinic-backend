import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
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
