import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';

/**
 * Một cuộc trò chuyện cho mỗi cặp (chủ nuôi, bác sĩ) - không tách theo từng bé hay từng
 * lịch hẹn, vì chủ nuôi nghĩ "nhắn cho BS. Đức" chứ không nghĩ "nhắn về lịch hẹn số 3".
 * Trạng thái đã đọc giữ bằng mốc thời gian của mỗi bên thay vì cờ trên từng tin nhắn.
 */
@Entity({ name: 'conversations' })
@Index(['ownerId', 'doctorId'], { unique: true })
export class Conversation extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor?: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ name: 'last_message_at', type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ name: 'last_message_preview', type: 'varchar', length: 255, nullable: true })
  lastMessagePreview: string | null;

  @Column({ name: 'owner_last_read_at', type: 'timestamptz', nullable: true })
  ownerLastReadAt: Date | null;

  @Column({ name: 'doctor_last_read_at', type: 'timestamptz', nullable: true })
  doctorLastReadAt: Date | null;
}
