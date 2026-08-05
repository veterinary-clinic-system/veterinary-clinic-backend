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

/**
 * diagram.jpg `Invoice` box - tu P8-T1 khong con buoc phai gan vao mot lich hen.
 *
 * `appointmentId` nullable la thay doi PHA VO duy nhat cua ca ke hoach 10 phase: POS ban
 * cho khach vang lai khong co lich hen nao de gan. Luat "mot lich hen mot hoa don" van
 * duoc giu, nhung o dang chi muc unique CO DIEU KIEN (`where appointment_id is not
 * null`) - neu de UNIQUE thuong thi hoa don POS thu hai se dung vao hoa don POS thu nhat
 * qua cung mot gia tri NULL... o Postgres thi khong, nhung y dinh phai duoc viet ro.
 *
 * BON CON SO TIEN DUOC CHOT CUNG thay vi tinh dong tu `items`. Ly do la nguyen tac da
 * co san cua codebase (xem comment trong `invoice-item.entity.ts`): hoa don la chung tu
 * bat bien. Tinh dong thi mot hoa don co giam gia se ra so khac ngay khi cong thuc giam
 * gia doi, va ban in ra hom nay se khong khop ban in ra nam sau.
 */
@Entity({ name: 'invoices' })
@Index('idx_invoices_customer_created', ['customerId', 'createdAt'])
@Index('idx_invoices_source_created', ['source', 'createdAt'])
export class Invoice extends BaseEntity {
  /**
   * Ma hoa don doc duoc (`HD000123`). Do cot DEFAULT o tang CSDL sinh ra (sequence
   * `invoice_code_seq`), khong bao gio ghi tu ung dung - cung cach voi `pets.pet_code`.
   */
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

  /**
   * Khach hang cua hoa don.
   *
   * Hoa don kham cung dien cot nay (backfill tu `appointment -> pet -> owner`) du co the
   * suy ra qua hai phep JOIN: tab "lich su mua hang" va thong ke chi tieu cua khach can
   * gop CA hai loai hoa don trong mot cau truy van, ma mot ben khong co lich hen de JOIN.
   *
   * NULL la hop le va thuong gap o POS: khach mua le khong bat buoc phai co ho so.
   */
  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: User | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string | null;

  /** Chi nhanh phat sinh hoa don - hoa don kham lay tu lich hen, hoa don POS tu gio hang. */
  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  /** Tong tien hang truoc giam gia va thue = `SUM(price x quantity)` cua cac dong. */
  @Column({ name: 'subtotal', type: 'bigint', default: 0, transformer: moneyTransformer })
  subtotal: number;

  @Column({ name: 'discount_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  discountAmount: number;

  @Column({ name: 'tax_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  taxAmount: number;

  /**
   * So tien phai tra = `subtotal - discountAmount + taxAmount`.
   *
   * Rang buoc nay duoc lap lai o CSDL (`chk_invoices_total_consistent`): mot hoa don
   * lech tong la loi khong the sua bang bao cao, nen chan ngay tai cho ghi.
   */
  @Column({ name: 'total_amount', type: 'bigint', default: 0, transformer: moneyTransformer })
  totalAmount: number;

  /**
   * Trang thai hoa don - BAN CACHE cua mot phep tinh tren `payments`, khong dat bang
   * tay. Xem `deriveInvoiceStatus` va `PaymentsService.syncStatus`.
   */
  @Column({ name: 'status', type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING })
  status: InvoiceStatus;

  /**
   * Phuong thuc thanh toan cua lan tra GAN NHAT - giu lai tu truoc P8 de man hinh cu va
   * bao cao doanh thu khong phai doi cung luc. Tu P8-T2, nguon su that ve tien la bang
   * `payments` (mot hoa don co the tra nhieu lan, nhieu phuong thuc).
   */
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'paid', default: false })
  paid: boolean;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Luu vet huy hoa don (P8-T3) - cung khuon voi `appointments.cancel_reason` cua P3.
   * Hoa don khong bi xoa khi huy: chung tu da phat hanh phai con doc duoc, va ly do huy
   * la thu ke toan hoi dau tien khi doi soat.
   */
  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items?: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments?: Payment[];
}
