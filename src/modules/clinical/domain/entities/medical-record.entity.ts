import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecordStatus } from '@/shared/common/enums/medical-record-status.enum';
import { Examination } from './examination.entity';
import { Diagnosis } from './diagnosis.entity';

/**
 * Ho so benh an - aggregate root cua SRS FR-07..FR-10.
 *
 * QUAN HE VOI `Examination` (quyet dinh "Hybrid" - xem docs/plan/README.md):
 * `Examination` KHONG bi tach nho. No dang giu dung vai SRS giao cho `Examination`
 * (sinh hieu + trieu chung) va dang duoc BillingService/PrescreeningService/
 * ReportsService dung. `MedicalRecord` la lop BOC BEN NGOAI:
 *
 *   Appointment 1--1 MedicalRecord 1--1 Examination
 *                          |--< Diagnosis
 *                          |--< Treatment
 *                          |--< Prescription
 *                          '--< LabTestOrder
 *
 * `petId` duoc DENORMALISE tu `appointment.petId` co chu dich: moi truy van "benh su
 * cua con nay" deu di qua day, join nguoc qua appointments moi lan la lang phi. Doi
 * lai phai giu hai cho khop nhau - `MedicalRecordsService` la noi duy nhat ghi cot
 * nay, va no luon lay tu chinh lich hen.
 */
@Entity({ name: 'medical_records' })
@Index(['petId', 'createdAt'])
export class MedicalRecord extends BaseEntity {
  @OneToOne(() => Appointment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id' })
  appointmentId: string;

  /** Ban sao cua `appointment.petId` - xem ghi chu ve denormalise o tren. */
  @ManyToOne(() => Pet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'pet_id' })
  petId: string;

  /** Bac si chiu trach nhiem ho so nay (BR-07: chi bac si duoc tao ho so benh an). */
  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  /**
   * Hai truong FR-07 doi ma `Examination` chua co.
   *
   * `visitReason` khac `Appointment.otherSymptoms`: cai kia la loi KHACH tu ke luc dat
   * lich, cai nay la ly do kham do BAC SI ghi lai sau khi hoi benh - hai thu thuong
   * khac nhau ("cho bo an" vs "nghi tac ruot").
   */
  @Column({ name: 'visit_reason', type: 'text', nullable: true })
  visitReason: string | null;

  /** Tinh trang chung khi tiep nhan ("tinh tao, phan ung tot" ...). */
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

  /** Thoi diem chot ho so. Null khi con DRAFT. */
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToOne(() => Examination, (examination) => examination.medicalRecord)
  examination?: Examination;

  @OneToMany(() => Diagnosis, (diagnosis) => diagnosis.medicalRecord)
  diagnoses?: Diagnosis[];

  // `treatments` (P4-T3) duoc noi vao day o task cua no.
}
