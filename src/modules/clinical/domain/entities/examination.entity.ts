import { Column, Entity, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { MedicalRecord } from './medical-record.entity';

@Entity({ name: 'examinations' })
export class Examination extends BaseEntity {
  @OneToOne(() => Appointment, (appointment) => appointment.examination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @OneToOne(() => MedicalRecord, (record) => record.examination, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord | null;

  @Column({ name: 'medical_record_id', type: 'varchar', nullable: true })
  medicalRecordId: string | null;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

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
}
