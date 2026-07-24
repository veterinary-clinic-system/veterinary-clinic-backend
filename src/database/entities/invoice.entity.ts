import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Appointment } from './appointment.entity';
import { PaymentMethod } from '@/common/enums/payment-method.enum';
import { InvoiceItem } from './invoice-item.entity';

/** diagram.jpg `Invoice` box - auto-generated from services/medications rendered on an appointment. */
@Entity({ name: 'invoices' })
export class Invoice extends BaseEntity {
  @OneToOne(() => Appointment, (appointment) => appointment.invoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'paid', default: false })
  paid: boolean;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items?: InvoiceItem[];
}
