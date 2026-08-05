import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { PrescriptionStatus } from '@/shared/common/enums/prescription-status.enum';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { MedicalRecord } from './medical-record.entity';
import { PrescriptionItem } from './prescription-item.entity';

/**
 * Not in diagram.jpg - added for prompt.md Section 4.1.4 ("Prescribe medication:
 * dosage, number of days"). One medical record can hold several Prescriptions, each
 * grouping multiple PrescriptionItem lines (one per medication).
 *
 * Khoa ngoai la `medical_record_id` tu P4-T6 (truoc do la `examination_id`): theo SRS,
 * don thuoc la mot KHOI CUA HO SO BENH AN chu khong phai cua rieng phan sinh hieu.
 */
@Entity({ name: 'prescriptions' })
// Truy van nong nhat cua quay thuoc: "cac don dang cho cap phat, cu nhat truoc".
@Index('idx_prescriptions_status_created', ['status', 'createdAt'])
export class Prescription extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.prescriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** Vong doi FR-11-03 - xem `prescription-status.enum.ts`. */
  @Column({
    name: 'status',
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.PRESCRIBED,
  })
  status: PrescriptionStatus;

  /**
   * Duoc si da cap phat. `ON DELETE SET NULL`: nhan vien nghi viec khong duoc lam mat
   * don thuoc - cung danh doi da chap nhan o `InventoryTransaction.performedByUser`.
   */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'dispensed_by_user_id' })
  dispensedByUser: User | null;

  @Column({ name: 'dispensed_by_user_id', type: 'uuid', nullable: true })
  dispensedByUserId: string | null;

  @Column({ name: 'dispensed_at', type: 'timestamptz', nullable: true })
  dispensedAt: Date | null;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, { cascade: true })
  items?: PrescriptionItem[];
}
