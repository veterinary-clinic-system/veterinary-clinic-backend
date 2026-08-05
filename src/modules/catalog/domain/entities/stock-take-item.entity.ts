import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { InventoryItem } from './inventory-item.entity';
import { Item } from './item.entity';
import { StockTake } from './stock-take.entity';

/** Mot dong dem thuc te tren phieu kiem ke - SRS FR-18-03. */
@Entity({ name: 'stock_take_items' })
@Index('idx_stock_take_items_stock_take', ['stockTakeId'])
export class StockTakeItem extends BaseEntity {
  @ManyToOne(() => StockTake, (stockTake) => stockTake.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stock_take_id' })
  stockTake: StockTake;

  @Column({ name: 'stock_take_id' })
  stockTakeId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId: string;

  /**
   * Nhan ban tu `inventoryItem.itemId` de man hinh kiem ke hien ten hang ma khong phai
   * join hai cap - cung ly do voi `branchId` tren `InventoryTransaction`.
   */
  @ManyToOne(() => Item, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  /** So he thong CHUP luc tao phieu - xem comment dau `StockTake`. */
  @Column({ name: 'system_quantity', type: 'integer' })
  systemQuantity: number;

  /** So dem thuc te. `null` = chua dem den dong nay. */
  @Column({ name: 'counted_quantity', type: 'integer', nullable: true })
  countedQuantity: number | null;

  /** Ly do chenh lech - man hinh yeu cau nhap khi `countedQuantity <> systemQuantity`. */
  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  /**
   * Chenh lech = dem thuc te - so he thong. Duong la thua, am la thieu.
   *
   * KHONG luu thanh cot: no la hieu cua hai cot ngay ben canh, va mot cot phai sinh luu
   * san la mot cot co the lech. Man hinh va service deu goi ham nay.
   */
  get discrepancy(): number | null {
    return this.countedQuantity === null ? null : this.countedQuantity - this.systemQuantity;
  }
}
