import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';
import { Invoice } from './invoice.entity';

@Entity({ name: 'payments' })
@Index('idx_payments_invoice_created', ['invoiceId', 'createdAt'])
export class Payment extends BaseEntity {
  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @Column({ name: 'amount', type: 'bigint', transformer: moneyTransformer })
  amount: number;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ name: 'status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'reference_code', type: 'varchar', length: 128, nullable: true })
  referenceCode: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by_user_id' })
  receivedBy: User | null;

  @Column({ name: 'received_by_user_id', type: 'uuid', nullable: true })
  receivedByUserId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
