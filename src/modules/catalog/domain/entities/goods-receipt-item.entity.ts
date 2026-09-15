import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { GoodsReceipt } from './goods-receipt.entity';
import { InventoryBatch } from './inventory-batch.entity';
import { Item } from './item.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

@Entity({ name: 'goods_receipt_items' })
@Index('idx_goods_receipt_items_receipt', ['goodsReceiptId'])
export class GoodsReceiptItem extends BaseEntity {
  @ManyToOne(() => GoodsReceipt, (receipt) => receipt.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goods_receipt_id' })
  goodsReceipt: GoodsReceipt;

  @Column({ name: 'goods_receipt_id' })
  goodsReceiptId: string;

  @ManyToOne(() => PurchaseOrderItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchase_order_item_id' })
  purchaseOrderItem: PurchaseOrderItem | null;

  @Column({ name: 'purchase_order_item_id', type: 'uuid', nullable: true })
  purchaseOrderItemId: string | null;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'quantity', type: 'integer' })
  quantity: number;

  @Column({ name: 'unit_cost', type: 'bigint', default: 0, transformer: moneyTransformer })
  unitCost: number;

  @Column({ name: 'batch_no', length: 64 })
  batchNo: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @ManyToOne(() => InventoryBatch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: InventoryBatch | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;
}
