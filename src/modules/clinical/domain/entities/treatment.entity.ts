import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { MedicalRecord } from './medical-record.entity';

@Entity({ name: 'treatments' })
export class Treatment extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.treatments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  @Column({ name: 'method', length: 255 })
  method: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @Column({ name: 'instruction', type: 'text', nullable: true })
  instruction: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
