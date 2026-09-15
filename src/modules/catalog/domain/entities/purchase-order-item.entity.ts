import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from './item.entity';
import { PurchaseOrder } from './purchase-order.entity';

@Entity({ name: 'purchase_order_items' })
@Index('idx_purchase_order_items_order', ['purchaseOrderId'])
export class PurchaseOrderItem extends BaseEntity {
  @ManyToOne(() => PurchaseOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'quantity', type: 'integer' })
  quantity: number;

  @Column({ name: 'unit_cost', type: 'bigint', default: 0, transformer: moneyTransformer })
  unitCost: number;

  @Column({ name: 'received_quantity', type: 'integer', default: 0 })
  receivedQuantity: number;
}
