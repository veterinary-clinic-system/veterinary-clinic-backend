import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
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

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, { cascade: true })
  items?: PrescriptionItem[];
}
