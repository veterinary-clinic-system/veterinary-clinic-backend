import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { MedicalRecord } from './medical-record.entity';
import { LaboratoryResult } from './laboratory-result.entity';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

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

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'technician_user_id' })
  technician: User | null;

  @Column({ name: 'technician_user_id', type: 'uuid', nullable: true })
  technicianUserId: string | null;

  @Column({ name: 'result_date', type: 'timestamptz', nullable: true })
  resultDate: Date | null;

  @OneToMany(() => LaboratoryResult, (result) => result.labTestOrder)
  results?: LaboratoryResult[];
}
