import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Vaccine } from '@/modules/catalog/domain/entities/vaccine.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { MedicalRecord } from './medical-record.entity';

@Entity({ name: 'vaccinations' })
@Index(['petId', 'vaccinatedAt'])
export class Vaccination extends BaseEntity {
  @ManyToOne(() => Pet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pet_id' })
  pet: Pet;

  @Column({ name: 'pet_id' })
  petId: string;

  @ManyToOne(() => Vaccine, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vaccine_id' })
  vaccine: Vaccine;

  @Column({ name: 'vaccine_id' })
  vaccineId: string;

  @ManyToOne(() => MedicalRecord, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord | null;

  @Column({ name: 'medical_record_id', type: 'uuid', nullable: true })
  medicalRecordId: string | null;

  @ManyToOne(() => Doctor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id' })
  doctorId: string;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'vaccinated_at', type: 'timestamptz' })
  vaccinatedAt: Date;

  @Column({ name: 'dose_number', type: 'int', default: 1 })
  doseNumber: number;

  @Column({ name: 'batch_no', type: 'varchar', length: 64, nullable: true })
  batchNo: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate: string | null;
}
