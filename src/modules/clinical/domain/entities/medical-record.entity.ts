import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecordStatus } from '@/shared/common/enums/medical-record-status.enum';
import { Examination } from './examination.entity';
import { Diagnosis } from './diagnosis.entity';
import { Treatment } from './treatment.entity';
import { Prescription } from './prescription.entity';
import { LabTestOrder } from './lab-test-order.entity';
import { Vaccination } from './vaccination.entity';

@Entity({ name: 'medical_records' })
@Index(['petId', 'createdAt'])
export class MedicalRecord extends BaseEntity {
  @OneToOne(() => Appointment, (appointment) => appointment.medicalRecord, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  @ManyToOne(() => Pet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'pet_id' })
  petId: string;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ name: 'visit_reason', type: 'text', nullable: true })
  visitReason: string | null;

  @Column({ name: 'general_condition', type: 'text', nullable: true })
  generalCondition: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MedicalRecordStatus,
    default: MedicalRecordStatus.DRAFT,
  })
  status: MedicalRecordStatus;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToOne(() => Examination, (examination) => examination.medicalRecord)
  examination?: Examination;

  @OneToMany(() => Diagnosis, (diagnosis) => diagnosis.medicalRecord)
  diagnoses?: Diagnosis[];

  @OneToMany(() => Treatment, (treatment) => treatment.medicalRecord)
  treatments?: Treatment[];

  @OneToMany(() => Prescription, (prescription) => prescription.medicalRecord)
  prescriptions?: Prescription[];

  @OneToMany(() => LabTestOrder, (order) => order.medicalRecord)
  labTestOrders?: LabTestOrder[];

  @OneToMany(() => Vaccination, (vaccination) => vaccination.medicalRecord)
  vaccinations?: Vaccination[];
}
