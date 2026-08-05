import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { MedicationRoute } from '@/shared/common/enums/medication-route.enum';
import { Prescription } from './prescription.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';

/**
 * Mot dong thuoc duoc ke - prompt.md Section 4.1.4, day du bay truong cua SRS FR-11-01
 * tu P7-T1: Medicine, Quantity, Dosage, Frequency, Duration, Route, Instruction.
 */
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

  /**
   * SO LUONG THUC CAP - don vi theo `medication.unit` (vien, ml, lo...).
   *
   * Day la con so dung de TRU KHO khi cap phat (P7-T4) va de TINH TIEN o
   * `BillingService`. Truoc P7 ca hai cho deu phai lay tam `durationDays` vi khong co
   * truong nao khac; migration `1793000000000` da backfill `quantity = duration_days`
   * cho du lieu cu de so tien cua hoa don cu khong doi.
   */
  @Column({ name: 'quantity', type: 'integer', default: 1 })
  quantity: number;

  /** Lieu moi lan, vi du "1 vien". */
  @Column({ name: 'dosage', length: 255 })
  dosage: string;

  /**
   * Tan suat, vi du "2 lan/ngay" - SRS FR-11-01 ("Frequency").
   *
   * Van la text tu do chu khong phai so lan/ngay co cau truc: y lenh thuc te bao gom
   * ca nhung dang khong quy ve mot con so duoc ("khi sot tren 39 do", "cach ngay").
   * Vi vay `quantity` la mot truong RIENG do bac si nhap, khong suy ra tu day.
   */
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
