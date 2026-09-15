import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { PurchaseOrderStatus } from '@/shared/common/enums/purchase-order-status.enum';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Supplier } from './supplier.entity';

@Entity({ name: 'purchase_orders' })
@Index('idx_purchase_orders_branch_status', ['branchId', 'status'])
export class PurchaseOrder extends BaseEntity {
  
  @Column({ name: 'po_code', length: 32 })
  poCode: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
  })
  status: PurchaseOrderStatus;

  @Column({ name: 'order_date', type: 'date' })
  orderDate: string;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate: string | null;

  @Column({ name: 'total_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  totalAmount: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser: User | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => PurchaseOrderItem, (poItem) => poItem.purchaseOrder, { cascade: ['insert'] })
  items?: PurchaseOrderItem[];
}
