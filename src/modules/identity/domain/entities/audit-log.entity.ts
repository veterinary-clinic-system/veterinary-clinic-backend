import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
@Index('idx_audit_actor_time', ['actorUserId', 'createdAt'])
@Index('idx_audit_entity', ['entityName', 'entityId'])
export class AuditLog {
  @PrimaryColumn({ name: 'id', type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @PrimaryColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'action', type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'entity_name', type: 'varchar', length: 64 })
  entityName: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;
}
