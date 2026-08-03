import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Prescription } from './prescription.entity';
import { LabTestOrder } from './lab-test-order.entity';

/**
 * Implements diagram.jpg's `DoctorResult` box (Appointment 1:1, `diseaseGroups: string[]`,
 * `notes: string`) but named `Examination` and extended with the vitals/diagnosis/
 * attachments/follow-up fields prompt.md Section 4.1.4 requires ("record actual symptoms,
 * vital signs, and the formal diagnosis... store images/lab results attached to the
 * visit") since the diagram's two-field box only modeled the triage-accuracy-tracking
 * half of what a real exam record needs.
 */
@Entity({ name: 'examinations' })
export class Examination extends BaseEntity {
  @OneToOne(() => Appointment, (appointment) => appointment.examination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  /** Doctor-confirmed disease group name(s); compared against PreScreeningResult for AI-accuracy stats. */
  @Column({ name: 'disease_groups', type: 'text', array: true, default: [] })
  diseaseGroups: string[];

  @Column({ name: 'diagnosis_text', type: 'text', nullable: true })
  diagnosisText: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'temperature_celsius', type: 'numeric', precision: 4, scale: 1, nullable: true })
  temperatureCelsius: number | null;

  @Column({ name: 'weight_kg', type: 'numeric', precision: 6, scale: 2, nullable: true })
  weightKg: number | null;

  @Column({ name: 'heart_rate_bpm', type: 'smallint', nullable: true })
  heartRateBpm: number | null;

  @Column({ name: 'respiratory_rate_bpm', type: 'smallint', nullable: true })
  respiratoryRateBpm: number | null;

  @Column({ name: 'attachment_urls', type: 'text', array: true, default: [] })
  attachmentUrls: string[];

  @Column({ name: 'examined_at', type: 'timestamptz', default: () => 'now()' })
  examinedAt: Date;

  @OneToMany(() => Prescription, (prescription) => prescription.examination)
  prescriptions?: Prescription[];

  @OneToMany(() => LabTestOrder, (order) => order.examination)
  labTestOrders?: LabTestOrder[];
}
