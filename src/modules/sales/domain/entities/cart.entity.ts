import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { CartStatus } from '@/shared/common/enums/cart-status.enum';
import { CartItem } from './cart-item.entity';

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

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'staff_user_id' })
  staffUser: User | null;

  @Column({ name: 'staff_user_id', type: 'uuid', nullable: true })
  staffUserId: string | null;

  @Column({ name: 'status', type: 'enum', enum: CartStatus, default: CartStatus.OPEN })
  status: CartStatus;

  @Column({ name: 'discount_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  discountAmount: number;

  @Column({ name: 'discount_by_user_id', type: 'uuid', nullable: true })
  discountByUserId: string | null;

  @Column({ name: 'discount_note', type: 'text', nullable: true })
  discountNote: string | null;

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
