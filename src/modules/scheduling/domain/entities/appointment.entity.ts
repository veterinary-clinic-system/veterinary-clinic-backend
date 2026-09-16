import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { CommonSymptom } from '@/shared/common/enums/common-symptom.enum';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { PreScreeningResult } from '@/modules/triage/domain/entities/pre-screening-result.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';

@Entity({ name: 'appointments' })
@Index(['doctor', 'startAt'])
export class Appointment extends BaseEntity {
  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => Pet, (pet) => pet.appointments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'pet_id' })
  petId: string;

  @ManyToOne(() => Service, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booked_by_user_id' })
  bookedBy: User | null;

  @Column({ name: 'booked_by_user_id', type: 'varchar', nullable: true })
  bookedByUserId: string | null;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.PENDING })
  status: AppointmentStatus;

  @Column({
    name: 'priority_color',
    type: 'enum',
    enum: PriorityColor,
    nullable: true,
  })
  priorityColor: PriorityColor | null;

  @Column({ name: 'photo_urls', type: 'text', array: true, default: [] })
  photoUrls: string[];

  @Column({ name: 'video_urls', type: 'text', array: true, default: [] })
  videoUrls: string[];

  @Column({ type: 'enum', enum: CommonSymptom, array: true, default: [] })
  commonSymptoms: CommonSymptom[];

  @Column({ name: 'other_symptoms', type: 'text', nullable: true })
  otherSymptoms: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cancelled_by_user_id' })
  cancelledBy: User | null;

  @Column({ name: 'cancelled_by_user_id', type: 'varchar', nullable: true })
  cancelledByUserId: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string | null;

  @ManyToOne(() => Appointment, (appointment) => appointment.followUpAppointments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_appointment_id' })
  parentAppointment: Appointment | null;

  @Column({ name: 'parent_appointment_id', type: 'varchar', nullable: true })
  parentAppointmentId: string | null;

  @OneToMany(() => Appointment, (appointment) => appointment.parentAppointment)
  followUpAppointments?: Appointment[];

  @OneToOne(() => PreScreeningResult, (result) => result.appointment)
  preScreeningResult?: PreScreeningResult;

  @OneToOne(() => Examination, (examination) => examination.appointment)
  examination?: Examination;

  @OneToOne(() => MedicalRecord, (record) => record.appointment)
  medicalRecord?: MedicalRecord;

  @OneToOne(() => Invoice, (invoice) => invoice.appointment)
  invoice?: Invoice;
}
