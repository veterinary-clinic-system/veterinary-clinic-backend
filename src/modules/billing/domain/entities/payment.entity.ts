import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { moneyTransformer } from '@/shared/database/transformers/money.transformer';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';
import { Invoice } from './invoice.entity';

/**
 * Mot LAN thanh toan cua mot hoa don - SRS FR-21.
 *
 * Truoc P8, "thanh toan" chi la ba cot tren hoa don (`paid`, `paid_at`,
 * `payment_method`). Cau truc do khong ghi noi ba tinh huong co that o quay:
 *   - khach dat coc roi tra not (mot hoa don, nhieu lan tra),
 *   - tra mot phan tien mat mot phan chuyen khoan (mot lan tra, nhieu phuong thuc),
 *   - tra roi doi tra hang (hoan tien - can luu vet ai hoan, hoan bao nhieu, khi nao).
 *
 * `amount` AM la dong hoan tien (`status = REFUNDED`), duong la dong thu tien. Khong sua
 * dong cu khi hoan: chung tu tien la bat bien, y het `inventory_transactions` cua P6.
 */
@Entity({ name: 'payments' })
@Index('idx_payments_invoice_created', ['invoiceId', 'createdAt'])
export class Payment extends BaseEntity {
  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  /** Duong = thu tien, am = hoan tien. Don vi dong (bigint + moneyTransformer). */
  @Column({ name: 'amount', type: 'bigint', transformer: moneyTransformer })
  amount: number;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ name: 'status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  /** Thoi diem tien thuc su ve. NULL khi con `PENDING` - chua co gi de ghi. */
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Ma giao dich ben ngoai (VNPay `vnp_TransactionNo`, ma UNC cua chuyen khoan).
   *
   * De ke toan doi soat sao ke ngan hang voi hoa don - khong co no thi mot khoan chuyen
   * khoan vao tai khoan phong kham khong the noi lai voi hoa don nao ca.
   */
  @Column({ name: 'reference_code', type: 'varchar', length: 128, nullable: true })
  referenceCode: string | null;

  /** Nhan vien thu tien. NULL voi thanh toan tu dong qua cong (khong co ai o quay). */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by_user_id' })
  receivedBy: User | null;

  @Column({ name: 'received_by_user_id', type: 'uuid', nullable: true })
  receivedByUserId: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
