import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import { QueueSource, QueueStatus } from '@/shared/common/enums/queue-status.enum';
import { Appointment } from './appointment.entity';

/**
 * Mot luot cho tai quay le tan trong ngay. Khong co trong diagram.jpg - them de phuc
 * vu bon thao tac cua le tan: xac nhan khach da den, tao luot kham khong dat lich,
 * dua vao hang cho, gan bac si.
 *
 * Vi sao KHONG dung thang `Appointment` lam hang cho:
 *   - Khach vang lai chua duoc gan bac si thi chua the co `Appointment` (bang do bat
 *     buoc `doctor_id`, va rang buoc EXCLUDE `appointment_no_overlap` doi mot khung
 *     gio cu the cua dung mot bac si).
 *   - So thu tu, gio khach thuc su buoc vao phong kham, va viec khach bo ve giua chung
 *     la thong tin cua QUAY LE TAN, khong phai cua lich hen.
 *
 * `appointmentId` la lien ket tuy chon: co san ngay tu dau voi khach dat lich truoc,
 * va duoc dien vao sau (luc gan bac si) voi khach vang lai.
 */
@Entity({ name: 'queue_entries' })
@Index(['branch', 'queueDate', 'status'])
export class QueueEntry extends BaseEntity {
  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => Pet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'pet_id' })
  petId: string;

  /** Lich hen tuong ung. Null voi khach vang lai chua duoc gan bac si. */
  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @Column({ name: 'appointment_id', type: 'varchar', nullable: true })
  appointmentId: string | null;

  /** Bac si phu trach. Null khi luot cho van con o trang thai WAITING. */
  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor | null;

  @Column({ name: 'doctor_id', type: 'varchar', nullable: true })
  doctorId: string | null;

  /** Dich vu khach yeu cau - can de tinh thoi luong lich hen khi gan bac si. */
  @ManyToOne(() => Service, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  /**
   * Ngay cua hang cho, dang 'yyyy-MM-dd'. Tach rieng khoi `checkedInAt` de so thu tu
   * co the danh lai tu 1 moi ngay cho tung chi nhanh, va de truy van "hang cho hom
   * nay" khong phai tinh khoang thoi gian.
   */
  @Column({ name: 'queue_date', type: 'date' })
  queueDate: string;

  /** So thu tu trong ngay, duy nhat theo (chi nhanh, ngay). Bat dau tu 1. */
  @Column({ name: 'ticket_number', type: 'integer' })
  ticketNumber: number;

  @Column({ type: 'enum', enum: QueueStatus, default: QueueStatus.WAITING })
  status: QueueStatus;

  @Column({ type: 'enum', enum: QueueSource })
  source: QueueSource;

  /** Muc do uu tien - quyet dinh thu tu goi vao phong, khong phai so thu tu. */
  @Column({ name: 'priority_color', type: 'enum', enum: PriorityColor, nullable: true })
  priorityColor: PriorityColor | null;

  @Column({ name: 'common_symptoms', type: 'enum', enum: CommonSymptom, array: true, default: [] })
  commonSymptoms: CommonSymptom[];

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz', default: () => 'now()' })
  checkedInAt: Date;

  /** Luc khach duoc goi vao phong (chuyen sang IN_ROOM). */
  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt: Date | null;

  /** Luc luot cho ket thuc (DONE hoac CANCELLED). */
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  /** Nhan vien thao tac quay le tan. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_user_id', type: 'varchar', nullable: true })
  createdByUserId: string | null;
}
