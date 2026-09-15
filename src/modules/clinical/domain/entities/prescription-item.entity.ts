import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { MedicationRoute } from '@/shared/common/enums/medication-route.enum';
import { Prescription } from './prescription.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';

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

  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity: number;

  @Column({ name: 'dosage', length: 255 })
  dosage: string;

  @Column({ name: 'frequency', type: 'varchar', length: 255, nullable: true })
  frequency: string | null;

  @Column({ name: 'duration_days', type: 'smallint' })
  durationDays: number;

  @Column({
    name: 'route',
    type: 'enum',
    enum: MedicationRoute,
    default: MedicationRoute.ORAL,
  })
  route: MedicationRoute;

  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions: string | null;
}
