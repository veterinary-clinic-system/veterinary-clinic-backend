import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { Supplier } from './supplier.entity';

/**
 * Phieu nhap kho - SRS UC-05, BR-13.
 *
 * KHONG CO TRANG THAI (khong DRAFT/CONFIRMED). Phieu nhap ton tai la hang DA vao kho:
 * viec tao phieu va viec tang ton dien ra trong CUNG mot transaction, nen khong the co
 * phieu "da lap nhung chua vao kho". Mot phieu nhap nap va cho xac nhan se mo ra dung
 * tinh huong te nhat cua du lieu kho - phieu bi xac nhan hai lan, hoac quen xac nhan
 * roi kiem ke thay thieu ma khong hieu vi sao.
 *
 * Cung ly do, phieu nhap KHONG SUA VA KHONG XOA: no da sinh ra cac dong so cai bat
 * bien. Nhap sai thi lap mot dieu chinh kiem ke (P6-T6) co ghi ly do.
 */
@Entity({ name: 'goods_receipts' })
@Index('idx_goods_receipts_branch_received', ['branchId', 'receivedDate'])
export class GoodsReceipt extends BaseEntity {
  /** `GR00001`... Do cot DEFAULT cap khi INSERT, khong nhan tu client. */
  @Column({ name: 'receipt_code', length: 32 })
  receiptCode: string;

  /**
   * Don dat tuong ung. Nullable CO CHU DICH: hang mua le, hang mau, hang tra ve tu chi
   * nhanh khac deu vao kho ma khong co don dat nao ca. Bat buoc co don thi nhan vien se
   * bia mot don gia de lach.
   */
  @ManyToOne(() => PurchaseOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder | null;

  @Column({ name: 'purchase_order_id', type: 'uuid', nullable: true })
  purchaseOrderId: string | null;

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

  @Column({ name: 'received_date', type: 'date' })
  receivedDate: string;

  /** `SUM(quantity x unitCost)` cua cac dong - so tien THUC NHAN, khac so dat cua PO. */
  @Column({ name: 'total_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  totalAmount: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by_user_id' })
  receivedByUser: User | null;

  @Column({ name: 'received_by_user_id', type: 'uuid', nullable: true })
  receivedByUserId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => GoodsReceiptItem, (line) => line.goodsReceipt)
  items?: GoodsReceiptItem[];
}
