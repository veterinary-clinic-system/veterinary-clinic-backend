import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Item } from './item.entity';
import { Branch } from './branch.entity';

/** diagram.jpg `InventoryItem` box - per-branch stock level of an Item. */
@Entity({ name: 'inventory_items' })
@Index(['item', 'branch'], { unique: true })
export class InventoryItem extends BaseEntity {
  @ManyToOne(() => Item, (item) => item.inventoryItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'inventory_quantity', type: 'integer', default: 0 })
  inventoryQuantity: number;

  @Column({ name: 'active', default: true })
  active: boolean;
}
