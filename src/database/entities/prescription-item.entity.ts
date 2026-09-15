import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Prescription } from './prescription.entity';
import { Medication } from './medication.entity';

/** One prescribed medication line: dosage + duration, per prompt.md Section 4.1.4. */
@Entity({ name: 'prescription_items' })
export class PrescriptionItem extends BaseEntity {
  @ManyToOne(() => Prescription, (prescription) => prescription.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_id' })
  prescriptionId: string;

  @ManyToOne(() => Medication, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;

  @Column({ name: 'medication_id' })
  medicationId: string;

  /** e.g. "1 tablet twice a day" - human-readable dosage instruction. */
  @Column({ name: 'dosage', length: 255 })
  dosage: string;

  @Column({ name: 'duration_days', type: 'smallint' })
  durationDays: number;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions: string | null;
}
