import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';

/** Loại tin trong hộp thông báo của chủ nuôi (app VetCare). */
export enum OwnerNotificationType {
  APPOINTMENT_CONFIRMED = 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_UPDATED = 'APPOINTMENT_UPDATED',
  APPOINTMENT_CANCELLED = 'APPOINTMENT_CANCELLED',
  VACCINATION_DUE = 'VACCINATION_DUE',
}

/**
 * Hộp thông báo của chủ nuôi: mỗi thông báo gửi tới khách (xác nhận/nhắc lịch, nhắc tiêm)
 * để lại một dòng ở đây, xem lại được sau khi push đã trôi. Một thông báo đi qua nhiều
 * kênh (Zalo, Gmail, push) vẫn chỉ là một dòng nhờ `dedupe_key`.
 */
@Entity({ name: 'owner_notifications' })
@Index('idx_owner_notif_recipient_created', ['recipientUserId', 'createdAt'])
export class OwnerNotification extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient: User;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId: string;

  @Column({ name: 'type', type: 'varchar', length: 40 })
  type: OwnerNotificationType;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  /** Màn hình app mở khi bấm (vd. `/appointments/<id>`). */
  @Column({ name: 'link', type: 'varchar', length: 255, nullable: true })
  link: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200, unique: true })
  dedupeKey: string;
}
