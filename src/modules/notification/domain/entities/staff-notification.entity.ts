import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';

/**
 * Hop thu trong ung dung cua mot nhan vien - SRS FR-23 muc 18 (P10-T5).
 *
 * KHONG DUNG CHUNG BANG VOI `notifications`. Bang kia la nhat ky GUI TIN CHO KHACH:
 * `appointment_id`, `recipient_phone` va `scheduled_for` deu NOT NULL vi moi dong cua no
 * la mot lan nhac lich. Mot canh bao "thuoc sap het han" khong co lich hen, khong co so
 * dien thoai va khong co gio gui - nhet no vao do se buoc phai bo NOT NULL cua ca ba
 * cot, va tu luc ay khong con doc duoc bang kia nua.
 *
 * MOI NGUOI NHAN MOT DONG. Fan-out luc GHI chu khong phai luc doc: dem so chua doc cua
 * chuong thong bao la truy van chay nhieu nhat trong ca man hinh nhan vien (moi 60 giay,
 * moi tab dang mo), nen no phai la mot `COUNT` tren khoa da danh chi muc, khong phai mot
 * phep suy ra vai trò roi doi chieu voi bang da doc.
 */
@Entity({ name: 'staff_notifications' })
// Chi muc phuc vu dung hai truy van cua chuong: dem chua doc, va lay trang dau.
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

  /** Duong dan man hinh lien quan - "bam vao di thang toi noi" (acceptance P10-T5). */
  @Column({ name: 'link', type: 'varchar', length: 255, nullable: true })
  link: string | null;

  /** Chi nhanh phat sinh su kien; `null` khi su kien o pham vi toan he thong. */
  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  /** `null` = chua doc. Dung moc thoi gian thay vi co `boolean` de con biet doc luc nao. */
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /**
   * Khoa chong trung, suy ra tat dinh tu su kien + nguoi nhan.
   *
   * Cron canh bao ton kho chay moi sang; khong co khoa nay thi sau mot tuan nghi le,
   * duoc si mo may len se thay bay dong "Thuoc X sap het" giong het nhau.
   */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 200, unique: true })
  dedupeKey: string;
}
