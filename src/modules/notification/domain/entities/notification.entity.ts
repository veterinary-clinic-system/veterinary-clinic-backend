import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@/shared/common/enums/notification.enum';

/**
 * Not in diagram.jpg - the persisted log behind the NotificationProvider abstraction in
 * prompt.md Section 5.3. Every reminder/update attempt gets a row here regardless of
 * which provider (log/SMS/Zalo) actually sent it, so delivery can be audited and the
 * "log" provider has somewhere real to write to instead of only stdout.
 */
@Entity({ name: 'notifications' })
export class Notification extends BaseEntity {
  @ManyToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ name: 'recipient_phone', length: 20 })
  recipientPhone: string;

  /**
   * Dia chi thu cua nguoi nhan, CHUP LAI luc lap lich (P10-T6).
   *
   * Chup chu khong tra cuu lai luc gui - cung ly le voi `recipientPhone` ngay tren: mot
   * ban ghi gui tin phai noi duoc no da gui DEN DAU, ke ca khi khach doi email sau do.
   * `null` khi khach khong de lai email, va khi ay kenh `EMAIL` tu bao that bai.
   */
  @Column({ name: 'recipient_email', type: 'varchar', length: 255, nullable: true })
  recipientEmail: string | null;

  @Column({ name: 'message', type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: NotificationStatus, default: NotificationStatus.PENDING })
  status: NotificationStatus;

  @Column({ name: 'scheduled_for', type: 'timestamptz' })
  scheduledFor: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /**
   * So lan da thu gui - P10-T6.
   *
   * Truoc do mot lan gui hong la vinh vien: `sendDueNotifications` chi lay cac dong
   * `PENDING`, nen dong vua bi danh `FAILED` khong bao gio duoc nhin lai. Mot nha cung
   * cap SMS chap chon nua phut la mat han lan nhac lich do. Cot nay cho phep cron thu
   * lai co gioi han - xem `MAX_SEND_ATTEMPTS`.
   */
  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount: number;
}
