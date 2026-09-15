import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { InvoiceSource } from '@/shared/common/enums/invoice-source.enum';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';

@Entity({ name: 'invoices' })
@Index('idx_invoices_customer_created', ['customerId', 'createdAt'])
@Index('idx_invoices_source_created', ['source', 'createdAt'])
export class Invoice extends BaseEntity {
  
  @Column({ name: 'invoice_code', length: 32, insert: false, update: false })
  invoiceCode: string;

  @Column({ name: 'source', type: 'enum', enum: InvoiceSource, default: InvoiceSource.CLINIC })
  source: InvoiceSource;

  @OneToOne(() => Appointment, (appointment) => appointment.invoice, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: User | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'subtotal', type: 'bigint', default: 0, transformer: moneyTransformer })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  discountAmount: number;

  @Column({ name: 'tax_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  totalAmount: number;

  @Column({ name: 'status', type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'paid', default: false })
  paid: boolean;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items?: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments?: Payment[];
}
