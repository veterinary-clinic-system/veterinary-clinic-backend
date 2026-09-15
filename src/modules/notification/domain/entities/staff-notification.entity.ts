import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';

@Entity({ name: 'staff_notifications' })

@Index('idx_staff_notif_recipient_unread', ['recipientUserId', 'readAt', 'createdAt'])
export class StaffNotification extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_user_id' })
  recipient: User;

  @Column({ name: 'recipient_user_id', type: 'uuid' })
  recipientUserId: string;

  @Column({ name: 'type', type: 'enum', enum: StaffNotificationType })
  type: StaffNotificationType;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'link', type: 'varchar', length: 255, nullable: true })
  link: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200, unique: true })
  dedupeKey: string;
}
