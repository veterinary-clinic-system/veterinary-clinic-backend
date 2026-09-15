import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Examination } from './examination.entity';
import { LabTestStatus } from '@/common/enums/lab-test-status.enum';

/** Not in diagram.jpg - added for prompt.md Section 4.1.4 ("order lab tests"). */
@Entity({ name: 'lab_test_orders' })
export class LabTestOrder extends BaseEntity {
  @ManyToOne(() => Examination, (examination) => examination.labTestOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'examination_id' })
  examination: Examination;

  @Column({ name: 'examination_id' })
  examinationId: string;

  @Column({ name: 'test_name', length: 255 })
  testName: string;

  @Column({ type: 'enum', enum: LabTestStatus, default: LabTestStatus.ORDERED })
  status: LabTestStatus;

  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string | null;

  @Column({ name: 'result_file_urls', type: 'text', array: true, default: [] })
  resultFileUrls: string[];
}
