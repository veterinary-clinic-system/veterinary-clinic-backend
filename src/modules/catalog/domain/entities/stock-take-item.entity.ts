import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { InventoryItem } from './inventory-item.entity';
import { Item } from './item.entity';
import { StockTake } from './stock-take.entity';

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

  @ManyToOne(() => Item, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'system_quantity', type: 'integer' })
  systemQuantity: number;

  @Column({ name: 'counted_quantity', type: 'integer', nullable: true })
  countedQuantity: number | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  get discrepancy(): number | null {
    return this.countedQuantity === null ? null : this.countedQuantity - this.systemQuantity;
  }
}
