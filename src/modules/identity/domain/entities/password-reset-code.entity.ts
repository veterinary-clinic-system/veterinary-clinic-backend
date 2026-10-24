import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from './user.entity';

/**
 * Mã khôi phục mật khẩu (6 chữ số) gửi qua Zalo/Gmail. Chỉ lưu bản băm; mã hết hạn sau
 * vài phút, bị khoá sau số lần nhập sai cho phép, và dùng được đúng một lần.
 */
@Entity({ name: 'password_reset_codes' })
@Index('idx_password_reset_codes_user', ['userId', 'createdAt'])
export class PasswordResetCode extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'attempts', type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
