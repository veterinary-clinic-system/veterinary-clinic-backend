import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Transactional Outbox - Phan IV.2 tai lieu kien truc.
 *
 * Van de kinh dien duoc giai quyet o day: xac nhan lich hen thanh cong nhung gui SMS
 * that bai, hoac nguoc lai - gui SMS xong roi transaction bi rollback, khach nhan tin
 * ve mot lich hen khong ton tai.
 *
 * Cach lam: su kien duoc INSERT trong CUNG transaction voi thay doi nghiep vu. Neu
 * transaction rollback thi su kien cung bien mat. Worker doc bang nay roi day sang
 * BullMQ de gui that.
 *
 * `dedupeKey` UNIQUE la thu bao dam tinh idempotent: chay lai worker (sau su co, sau
 * khi deploy lai) khong gui trung tin nhan cho khach hang.
 *
 * KHONG ke thua BaseEntity: bang nay khong can `updated_at` (su kien la bat bien) va
 * khong can xoa mem (su kien da xu ly duoc don dep dinh ky bang DELETE that).
 */
@Entity({ name: 'outbox_events' })
// Chi muc phuc vu dung mot truy van cua worker: "lay cac su kien chua xu ly, cu nhat truoc".
// Partial index nen no chi chua cac dong CHUA xu ly - bang co the co hang trieu dong
// da xu ly ma chi muc van nho.
@Index('idx_outbox_unprocessed', ['createdAt'], { where: '"processed_at" IS NULL' })
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Vi du: 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_REMINDER'. */
  @Column({ name: 'type', type: 'varchar', length: 64 })
  type: string;

  /** Du lieu can de xu ly su kien. JSONB de hinh dang payload doi duoc khong can migrate. */
  @Column({ name: 'payload', type: 'jsonb' })
  payload: Record<string, unknown>;

  /** Khoa chong trung - UNIQUE. Vi du: 'appt:<id>:confirm'. */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 255, unique: true })
  dedupeKey: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  /** null = chua xu ly. Worker dat gia tri nay sau khi day job thanh cong. */
  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  /** So lan thu that bai, de canh bao khi mot su kien ket o day qua lau. */
  @Column({ name: 'attempts', type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;
}
