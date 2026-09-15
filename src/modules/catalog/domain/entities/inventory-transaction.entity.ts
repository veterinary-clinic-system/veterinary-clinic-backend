import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { InventoryBatch } from './inventory-batch.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity({ name: 'inventory_transactions' })

@Index('idx_inventory_transactions_item_created', ['inventoryItemId', 'createdAt'])
@Index('idx_inventory_transactions_branch_created', ['branchId', 'createdAt'])
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem: InventoryItem;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId: string;

  @ManyToOne(() => InventoryBatch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_id' })
  batch: InventoryBatch | null;

  @Column({ name: 'batch_id', type: 'uuid', nullable: true })
  batchId: string | null;

  @ManyToOne(() => Branch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'type', type: 'enum', enum: InventoryTransactionType })
  type: InventoryTransactionType;

  @Column({ name: 'quantity_change', type: 'integer' })
  quantityChange: number;

  @Column({ name: 'quantity_after', type: 'integer' })
  quantityAfter: number;

  @Column({
    name: 'reference_type',
    type: 'enum',
    enum: InventoryReferenceType,
    default: InventoryReferenceType.MANUAL,
  })
  referenceType: InventoryReferenceType;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'performed_by_user_id' })
  performedByUser: User | null;

  @Column({ name: 'performed_by_user_id', type: 'uuid', nullable: true })
  performedByUserId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
