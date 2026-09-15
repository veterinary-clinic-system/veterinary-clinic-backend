import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { DiagnosisSeverity } from '@/shared/common/enums/medical-record-status.enum';
import { MedicalRecord } from './medical-record.entity';

@Entity({ name: 'diagnoses' })
export class Diagnosis extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.diagnoses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  @ManyToOne(() => Disease, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'disease_id' })
  disease: Disease | null;

  @Column({ name: 'disease_id', type: 'varchar', nullable: true })
  diseaseId: string | null;

  @Column({ name: 'diagnosis_text', type: 'text' })
  diagnosisText: string;

  @Column({
    name: 'severity',
    type: 'enum',
    enum: DiagnosisSeverity,
    default: DiagnosisSeverity.MILD,
  })
  severity: DiagnosisSeverity;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;
}
