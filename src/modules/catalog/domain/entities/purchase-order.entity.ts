import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { PurchaseOrderStatus } from '@/shared/common/enums/purchase-order-status.enum';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { Supplier } from './supplier.entity';

/**
 * Don dat hang gui nha cung cap - SRS UC-05.
 *
 * Tach hoan toan khoi phieu nhap (`GoodsReceipt`, P6-T5): mot don co the duoc giao lam
 * nhieu dot, va so DAT khac so NHAN. Gop hai khai niem vao mot bang thi khong con
 * chenh lech nao de doi soat voi nha cung cap.
 *
 * `totalAmount` la SO DAT (`SUM(quantity x unitCost)`), khong phai so tien thuc tra -
 * so thuc tra tinh tu cac phieu nhap.
 */
@Entity({ name: 'purchase_orders' })
@Index('idx_purchase_orders_branch_status', ['branchId', 'status'])
export class PurchaseOrder extends BaseEntity {
  /**
   * Ma don (`PO0001`...). Do cot DEFAULT cap khi INSERT, khong nhan tu client - cung
   * cach voi `suppliers.supplier_code`.
   */
  @Column({ name: 'po_code', length: 32 })
  poCode: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  /** Chi nhanh nhan hang - hang se vao kho cua chi nhanh nay khi lap phieu nhap. */
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

  /** Ngay dat. `date` chu khong `timestamptz` - la mot ngay tren chung tu. */
  @Column({ name: 'order_date', type: 'date' })
  orderDate: string;

  /** Ngay hen giao. Nullable: khong phai nha cung cap nao cung cam ket ngay. */
  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate: string | null;

  /**
   * Tong tien DAT, tinh bang DONG. La gia tri phai sinh tu cac dong - duoc tinh lai o
   * `PurchaseOrdersService` moi lan don doi, khong nhan tu client.
   */
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
