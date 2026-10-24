import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';

export enum DevicePlatform {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

/** Expo push token của một máy đang đăng nhập app chủ nuôi. */
@Entity({ name: 'device_tokens' })
export class DeviceToken extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Index('idx_device_tokens_user')
  @Column({ name: 'user_id' })
  userId: string;

  /** Chép từ users.phone lúc đăng ký - kênh PUSH tìm máy theo recipient_phone. */
  @Index('idx_device_tokens_phone')
  @Column({ name: 'phone', length: 20 })
  phone: string;

  @Column({ name: 'token', length: 255, unique: true })
  token: string;

  @Column({ type: 'enum', enum: DevicePlatform, enumName: 'device_tokens_platform_enum' })
  platform: DevicePlatform;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;
}
