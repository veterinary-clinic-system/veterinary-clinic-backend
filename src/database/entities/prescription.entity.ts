import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Examination } from './examination.entity';
import { PrescriptionItem } from './prescription-item.entity';

/**
 * Not in diagram.jpg - added for prompt.md Section 4.1.4 ("Prescribe medication:
 * dosage, number of days"). One Examination can produce one Prescription grouping
 * multiple PrescriptionItem lines (one per medication).
 */
@Entity({ name: 'prescriptions' })
export class Prescription extends BaseEntity {
  @ManyToOne(() => Examination, (examination) => examination.prescriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'examination_id' })
  examination: Examination;

  @Column({ name: 'examination_id' })
  examinationId: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => PrescriptionItem, (item) => item.prescription, { cascade: true })
  items?: PrescriptionItem[];
}
