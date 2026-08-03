import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Nhat ky kiem toan - rang buoc R6 (du lieu y te can audit, bat bien, luu lau dai).
 *
 * Bang nay duoc PARTITION THEO THANG o tang CSDL (Phan V.4 quyet dinh #8). Ly do:
 * day la bang tang nhanh nhat he thong; khi can don du lieu cu thi `DROP PARTITION`
 * la thao tac tuc thi, con `DELETE ... WHERE created_at < ...` thi cham va de lai
 * bloat phai VACUUM.
 *
 * Vi la bang phan manh nen KHOA CHINH phai gom ca `created_at` - PostgreSQL bat buoc
 * moi rang buoc duy nhat phai chua khoa phan manh. Do do bang nay khong ke thua
 * BaseEntity (khoa chinh chi co `id`).
 *
 * TypeORM khong tao duoc bang phan manh: bang va cac partition duoc tao bang SQL tho
 * trong migration, entity nay chi dung de DOC va de GHI qua repository.
 */
@Entity({ name: 'audit_logs' })
@Index('idx_audit_actor_time', ['actorUserId', 'createdAt'])
@Index('idx_audit_entity', ['entityName', 'entityId'])
export class AuditLog {
  @PrimaryColumn({ name: 'id', type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  /** Thanh phan thu hai cua khoa chinh - bat buoc voi bang phan manh. */
  @PrimaryColumn({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  /** null khi hanh dong do he thong tu thuc hien (worker, cron). */
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  /** Vi du: 'CREATE', 'UPDATE', 'SOFT_DELETE', 'LOGIN', 'EXPORT'. */
  @Column({ name: 'action', type: 'varchar', length: 64 })
  action: string;

  /** Ten bang/thuc the bi tac dong, vi du 'examinations'. */
  @Column({ name: 'entity_name', type: 'varchar', length: 64 })
  entityName: string;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  /** Anh chup thay doi (truoc/sau). JSONB de khong phai migrate moi lan doi hinh dang. */
  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;
}
