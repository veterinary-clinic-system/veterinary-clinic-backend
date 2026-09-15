import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { InventoryItem } from './inventory-item.entity';
import { Supplier } from './supplier.entity';

@Entity({ name: 'inventory_batches' })
@Index(['inventoryItemId', 'batchNo'], { unique: true })
export class InventoryBatch extends BaseEntity {
  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId: string;

  @Column({ name: 'batch_no', length: 64 })
  batchNo: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'quantity', type: 'integer', default: 0 })
  quantity: number;

  @Column({ name: 'cost_price', type: 'bigint', default: 0, transformer: moneyTransformer })
  costPrice: number;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'now()' })
  receivedAt: Date;

  @ManyToOne(() => Supplier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_id', type: 'varchar', nullable: true })
  supplierId: string | null;

  @Column({ name: 'goods_receipt_id', type: 'uuid', nullable: true })
  goodsReceiptId: string | null;
}
