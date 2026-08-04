import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { MedicalRecord } from './medical-record.entity';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

/**
 * Not in diagram.jpg - added for prompt.md Section 4.1.4 ("order lab tests").
 *
 * Khoa ngoai la `medical_record_id` tu P4-T6 - cung ly do voi `Prescription`: khoi
 * "Laboratory" cua SRS thuoc ve ho so benh an, khong thuoc rieng phan sinh hieu.
 */
@Entity({ name: 'lab_test_orders' })
export class LabTestOrder extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.labTestOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  @Column({ name: 'test_name', length: 255 })
  testName: string;

  @Column({ type: 'enum', enum: LabTestStatus, default: LabTestStatus.ORDERED })
  status: LabTestStatus;

  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string | null;

  @Column({ name: 'result_file_urls', type: 'text', array: true, default: [] })
  resultFileUrls: string[];
}
