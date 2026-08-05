import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { CartStatus } from '@/shared/common/enums/cart-status.enum';
import { CartItem } from './cart-item.entity';

/**
 * Gio hang tai quay - SRS FR-19, muc 12.5.
 *
 * GIO NAM O SERVER, KHONG O `localStorage`. Day la mot quyet dinh nghiep vu chu khong
 * phai so thich ky thuat: nhan vien doi may giua chung (may quet ma vach hong, khach
 * chuyen sang quay khac), va ca sau can nhin thay gio dang do cua ca truoc. Gio o trinh
 * duyet thi ca hai tinh huong deu mat sach - va mat mot gio hang muoi mon dang dem la
 * mot hang khach phai dung cho lam lai tu dau.
 *
 * `customerId` NULLABLE: khach mua le khong bat buoc phai co ho so. Bat tao ho so moi
 * ban duoc mot goi thuc an la cach nhanh nhat de co mot bang khach hang day rac.
 */
@Entity({ name: 'carts' })
@Index('idx_carts_branch_status', ['branchId', 'status'])
export class Cart extends BaseEntity {
  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: User | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  /** Nhan vien mo gio. Giu lai ke ca khi nguoi khac thanh toan ho - de doi soat ca truc. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'staff_user_id' })
  staffUser: User | null;

  @Column({ name: 'staff_user_id', type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ name: 'status', type: 'enum', enum: CartStatus, default: CartStatus.OPEN })
  status: CartStatus;

  /** Giam gia thu cong o muc gio hang - P8-T6. Khong duoc vuot tam tinh. */
  @Column({ name: 'discount_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  discountAmount: number;

  /** Ai ap giam gia - chuan bi cho audit log o P10. NULL khi khong giam gia. */
  @Column({ name: 'discount_by_user_id', type: 'uuid', nullable: true })
  discountByUserId: string | null;

  @Column({ name: 'discount_note', type: 'text', nullable: true })
  discountNote: string | null;

  /** Hoa don sinh ra khi thanh toan (P8-T5). NULL khi gio con `OPEN`. */
  @ManyToOne(() => Invoice, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
  items?: CartItem[];
}
