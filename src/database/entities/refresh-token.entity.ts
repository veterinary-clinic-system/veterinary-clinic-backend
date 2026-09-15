import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

/**
 * Not in diagram.jpg - required to implement the "full access-token + refresh-token
 * flow" fixed in prompt.md Section 2. We store a hash of each issued refresh token
 * (never the raw token) so refresh tokens can be revoked/rotated server-side (logout,
 * compromised-token invalidation) instead of relying purely on JWT expiry.
 */
@Entity({ name: 'refresh_tokens' })
export class RefreshToken extends BaseEntity {
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'replaced_by_token_hash', type: 'varchar', nullable: true })
  replacedByTokenHash: string | null;
}
