import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Vaccine } from '@/modules/catalog/domain/entities/vaccine.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { MedicalRecord } from './medical-record.entity';

/**
 * Mot mui tiem da thuc hien - SRS FR-12 (P9-T2).
 *
 * KHOA CHINH LA `petId`, KHONG PHAI `medicalRecordId`. Khac `Prescription` va
 * `LabTestOrder` (hai thu do khong ton tai ngoai mot lan kham), tiem chung la mot dich
 * vu don le rat thuong gap: khach dat lich chi de tiem nhac lai, khong kham gi ca.
 * `medicalRecordId` vi the nullable - co thi gan, khong co van la mot mui tiem hop le.
 *
 * `batchNo` VA `expiryDate` LA BAN CHEP, KHONG PHAI KHOA NGOAI toi `inventory_batches`.
 * Day la ban ghi y te: nam nam sau lo do co the da bi xoa khoi kho, hoac chi nhanh da
 * dong cua, nhung so tiem chung van phai doc duoc nguyen ven - do la thu khach mang di
 * lam giay kiem dich hoac dua cho phong kham khac. Cung nguyen tac voi `invoice_items`
 * chup gia tai thoi diem lap hoa don.
 *
 * `nextDueDate` cung la BAN CHEP cua ket qua tinh tu phac do trong danh muc, khong phai
 * cong thuc tinh lai moi lan doc: sua `intervalDays` cua mot loai vaccine ve sau khong
 * duoc phep lam doi lich nhac cua nhung mui da tiem xong.
 */
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

  /** Null khi tiem dich vu don le, khong di kem lan kham nao - xem ghi chu dau lop. */
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

  /**
   * Chi nhanh da tru kho. Khong co trong danh sach truong cua FR-12 nhung bat buoc phai
   * co: ton kho la theo chi nhanh (P6), nen khong luu lai thi khong doi soat duoc mui
   * tiem nay voi dong so cai da sinh ra no.
   */
  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'vaccinated_at', type: 'timestamptz' })
  vaccinatedAt: Date;

  /** Mui thu may trong phac do. 1-based. */
  @Column({ name: 'dose_number', type: 'int', default: 1 })
  doseNumber: number;

  /** Ma lo da xuat - ban chep, xem ghi chu dau lop. */
  @Column({ name: 'batch_no', type: 'varchar', length: 64, nullable: true })
  batchNo: string | null;

  /** Han dung cua lo da xuat - ban chep. */
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /**
   * Ngay den han mui ke tiep. Null = khong con mui nao phai nhac (phac do mot mui va
   * loai vaccine khong khai `boosterIntervalDays`).
   *
   * `date` chu khong `timestamptz`: day la mot ngay tren lich, khong phai mot thoi diem.
   */
  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate: string | null;
}
