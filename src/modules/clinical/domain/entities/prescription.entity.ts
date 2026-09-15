import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { PrescriptionStatus } from '@/shared/common/enums/prescription-status.enum';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { MedicalRecord } from './medical-record.entity';
import { PrescriptionItem } from './prescription-item.entity';

@Entity({ name: 'prescriptions' })

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

  @Column({
    name: 'status',
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.PRESCRIBED,
  })
  status: PrescriptionStatus;

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
