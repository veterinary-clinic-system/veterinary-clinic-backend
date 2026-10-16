import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { CallMedia, CallStatus } from '@/shared/common/enums/messaging.enum';
import { Conversation } from './conversation.entity';

/** Lịch sử cuộc gọi thoại/video. Nội dung cuộc gọi đi thẳng giữa hai trình duyệt (WebRTC), máy chủ không ghi. */
@Entity({ name: 'call_sessions' })
@Index(['conversationId', 'createdAt'])
export class CallSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'caller_user_id' })
  caller?: User;

  @Column({ name: 'caller_user_id' })
  callerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callee_user_id' })
  callee?: User;

  @Column({ name: 'callee_user_id' })
  calleeUserId: string;

  @Column({ type: 'enum', enum: CallMedia, enumName: 'call_sessions_media_enum' })
  media: CallMedia;

  @Column({
    type: 'enum',
    enum: CallStatus,
    enumName: 'call_sessions_status_enum',
    default: CallStatus.RINGING,
  })
  status: CallStatus;

  @Column({ name: 'answered_at', type: 'timestamptz', nullable: true })
  answeredAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'end_reason', type: 'varchar', length: 32, nullable: true })
  endReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
