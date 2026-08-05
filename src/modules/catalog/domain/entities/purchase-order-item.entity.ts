import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Item } from './item.entity';
import { PurchaseOrder } from './purchase-order.entity';

/** Mot dong hang tren don dat - SRS UC-05. */
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

  /** So DAT. */
  @Column({ name: 'quantity', type: 'integer' })
  quantity: number;

  /**
   * Gia nhap thoa thuan cho dong nay, tinh bang DONG.
   *
   * Chup lai tai thoi diem dat chu khong doc `product.costPrice` luc nhan hang: gia von
   * trong danh muc thay doi theo thoi gian, con don da dat thi gia da chot.
   */
  @Column({ name: 'unit_cost', type: 'bigint', default: 0, transformer: moneyTransformer })
  unitCost: number;

  /**
   * So da NHAN cong don qua cac phieu nhap. `GoodsReceiptsService` (P6-T5) la noi duy
   * nhat cap nhat cot nay, va tu no suy ra trang thai cua ca don.
   */
  @Column({ name: 'received_quantity', type: 'integer', default: 0 })
  receivedQuantity: number;
}
