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

  /**
   * Anh xa sang SRS FR-05-01: day CHINH LA truong `Reason` cua tai lieu ("ly do kham /
   * trieu chung khach tu ke"), con `notes` ben duoi la `Note` ("ghi chu noi bo cua nhan
   * vien"). Khong tach them mot cot `reason` rieng: hai cot se chua cung mot loai noi
   * dung, va moi bieu mau se phai chon bo mot trong hai - no la no ky thuat khong co
   * nguoi dung. Giao dien hien nhan "Ly do kham / trieu chung" cho cot nay.
   */
  @Column({ name: 'other_symptoms', type: 'text', nullable: true })
  otherSymptoms: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  /** `Note` cua FR-05-01 - ghi chu NOI BO, khach khong doc. Xem ghi chu tren `otherSymptoms`. */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  // ---------------------------------------------------------------------------------
  // Luu vet ket thuc bat thuong (FR-05-04)
  //
  // Dung cho CA `CANCELLED` lan `NO_SHOW` - `status` da phan biet duoc hai truong hop,
  // khong can hai bo cot. Lich hen ket thuc binh thuong (`COMPLETED`) de ca ba NULL.
  // ---------------------------------------------------------------------------------

  /** Nguoi bam huy / danh vang. Null voi du lieu cu tao truoc khi co luu vet nay. */
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

  /**
   * Ho so benh an cua lan kham nay (P4). Chieu nguoc lai duoc khai bao o day de cac
   * truy van bat dau tu `Appointment` - benh su cua thu cung chang han - nap thang
   * duoc ho so va cac chan doan cua no, khong phai truy van rieng mot vong nua.
   */
  @OneToOne(() => MedicalRecord, (record) => record.appointment)
  medicalRecord?: MedicalRecord;

  @OneToOne(() => Invoice, (invoice) => invoice.appointment)
  invoice?: Invoice;
}
