import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ItemType } from '@/common/enums/item-type.enum';
import { InvoiceItem } from './invoice-item.entity';
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

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ name: 'active', default: true })
  active: boolean;

  @OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.item)
  invoiceItems?: InvoiceItem[];

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.item)
  inventoryItems?: InventoryItem[];
}
