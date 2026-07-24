import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Doctor } from './doctor.entity';
import { Branch } from './branch.entity';
import { Pet } from './pet.entity';
import { Service } from './service.entity';
import { User } from './user.entity';
import { PriorityColor } from '@/common/enums/priority-color.enum';
import { CommonSymptom } from '@/common/enums/common-symptom.enum';
import { AppointmentStatus } from '@/common/enums/appointment-status.enum';
import { PreScreeningResult } from './pre-screening-result.entity';
import { Examination } from './examination.entity';
import { Invoice } from './invoice.entity';

/**
 * diagram.jpg `Appointment` box - the central booking/slot record. Two fields not in
 * the diagram were added: `status` (Section 4.1.2/5.1 booking-lifecycle + slot-blocking
 * logic) and `serviceId`/`bookedByUserId` (booking flow needs a service, and Section
 * 4.1.2 lets a Receptionist book "on a pet owner's behalf" so we track who booked it).
 * The diagram's `followUpAppointment : Appointment[]` / `appointment : Appointment`
 * pair is modeled as a self-referencing parent/children relation.
 */
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

  /** Who created the booking: null when the owner/guest self-booked online. */
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

  @Column({ type: 'enum', enum: CommonSymptom, array: true, default: [] })
  commonSymptoms: CommonSymptom[];

  @Column({ name: 'other_symptoms', type: 'text', nullable: true })
  otherSymptoms: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

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

  @OneToOne(() => Invoice, (invoice) => invoice.appointment)
  invoice?: Invoice;
}
