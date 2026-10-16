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
import { MessageKind } from '@/shared/common/enums/messaging.enum';
import { Conversation } from './conversation.entity';
import { CallSession } from './call-session.entity';

/** Tin nhắn chỉ thêm, không sửa/xoá - nên không kế thừa BaseEntity (không updated/deleted). */
@Entity({ name: 'messages' })
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: Conversation;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_user_id' })
  sender?: User;

  @Column({ name: 'sender_user_id' })
  senderUserId: string;

  @Column({ type: 'enum', enum: MessageKind, enumName: 'messages_kind_enum' })
  kind: MessageKind;

  @Column({ name: 'body', type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl: string | null;

  @ManyToOne(() => CallSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'call_id' })
  call?: CallSession | null;

  @Column({ name: 'call_id', type: 'uuid', nullable: true })
  callId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
