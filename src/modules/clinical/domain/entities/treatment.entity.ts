import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { MedicalRecord } from './medical-record.entity';

/**
 * Mot phuong phap dieu tri trong ho so benh an - SRS FR-10.
 *
 * Khai niem nay TRUOC P4 khong ton tai o dau ca: `Examination` chi co chan doan va
 * ghi chu, khong co cho ghi "da lam gi cho con vat". Don thuoc khong thay the duoc -
 * truyen dich, tiem, phau thuat, thay bang deu la dieu tri ma khong phai thuoc.
 *
 * `endDate` nullable co chu dich: dieu tri dang tiep dien (vi du "boi thuoc 2 lan/ngay
 * cho den khi het viem") chua biet ngay ket thuc. Rang buoc `endDate >= startDate`
 * duoc kiem o DTO va lap lai o tang CSDL (`chk_treatments_date_order`).
 */
@Entity({ name: 'treatments' })
export class Treatment extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.treatments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  /** Phuong phap ("Truyen dich", "Tiem khang sinh", "Phau thuat"...). */
  @Column({ name: 'method', length: 255 })
  method: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  /** Null = dieu tri con tiep dien. */
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** Huong dan cho chu nuoi lam tai nha - khac `description` (mo ta viec phong kham lam). */
  @Column({ name: 'instruction', type: 'text', nullable: true })
  instruction: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;
}
