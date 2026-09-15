import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Category } from './category.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity({ name: 'items' })
export class Item extends BaseEntity {
  @Column({ name: 'item_name', length: 255 })
  itemName: string;

  @Column({ name: 'image_url', type: 'varchar', default: '/images/default-item.svg' })
  imageUrl: string;

  @Column({ name: 'code', length: 32 })
  code: string;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'varchar', nullable: true })
  categoryId: string | null;

  @Column({ name: 'describe', type: 'text', nullable: true })
  describe: string | null;

  @Column({ type: 'enum', enum: ItemType, default: ItemType.OTHER })
  itemType: ItemType;

  @Column({ name: 'unit_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  unitPrice: number;

  @Column({ name: 'active', default: true })
  active: boolean;

  @OneToMany(() => InvoiceItem, (invoiceItem) => invoiceItem.item)
  invoiceItems?: InvoiceItem[];

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.item)
  inventoryItems?: InventoryItem[];
}
