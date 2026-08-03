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
}
