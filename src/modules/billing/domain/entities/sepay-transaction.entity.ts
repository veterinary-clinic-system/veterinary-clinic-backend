import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { SepayReconciliationStatus } from '@/shared/common/enums/sepay-reconciliation-status.enum';
import { Invoice } from './invoice.entity';
import { Payment } from './payment.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';

@Entity({ name: 'sepay_transactions' })
@Index('uq_sepay_transactions_provider_id', ['providerTransactionId'], { unique: true })
@Index('idx_sepay_transactions_status_received', ['status', 'receivedAt'])
export class SepayTransaction extends BaseEntity {
  @Column({ name: 'provider_transaction_id', type: 'varchar', length: 64 })
  providerTransactionId: string;

  @Column({ name: 'gateway', type: 'varchar', length: 64, nullable: true })
  gateway: string | null;

  @Column({ name: 'bank_reference', type: 'varchar', length: 128, nullable: true })
  bankReference: string | null;

  @Column({ name: 'account_number', type: 'varchar', length: 32, nullable: true })
  accountNumber: string | null;

  @Column({ name: 'transaction_date', type: 'timestamptz', nullable: true })
  transactionDate: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  receivedAt: Date;

  @Column({ name: 'transfer_amount', type: 'bigint', transformer: moneyTransformer })
  transferAmount: number;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'status', type: 'enum', enum: SepayReconciliationStatus })
  status: SepayReconciliationStatus;

  @Column({ name: 'review_reason', type: 'varchar', length: 64, nullable: true })
  reviewReason: string | null;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment | null;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedBy: User | null;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: Record<string, unknown>;
}
