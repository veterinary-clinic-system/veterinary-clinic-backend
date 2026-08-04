import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { DiagnosisSeverity } from '@/shared/common/enums/medical-record-status.enum';
import { MedicalRecord } from './medical-record.entity';

/**
 * Mot chan doan trong ho so benh an - SRS FR-09.
 *
 * Truoc P4, chan doan nam trong `examinations.disease_groups: text[]` +
 * `diagnosis_text`: mot mang chuoi thi khong gan duoc muc do nang, khong biet cai nao
 * la chan doan CHINH, va khong noi duoc sang danh muc `diseases`. Day la ly do FR-09
 * doi mot bang rieng.
 */
@Entity({ name: 'diagnoses' })
export class Diagnosis extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.diagnoses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  /**
   * Noi sang danh muc benh (TUY CHON). Bac si chan doan mot benh chua co trong danh
   * muc van phai ghi duoc - ep FK bat buoc se bien danh muc thanh vat can lam sang.
   * Khi co, bao cao P10 gom nhom theo cot nay thay vi so chuoi.
   */
  @ManyToOne(() => Disease, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'disease_id' })
  disease: Disease | null;

  @Column({ name: 'disease_id', type: 'varchar', nullable: true })
  diseaseId: string | null;

  @Column({ name: 'diagnosis_text', type: 'text' })
  diagnosisText: string;

  @Column({
    name: 'severity',
    type: 'enum',
    enum: DiagnosisSeverity,
    default: DiagnosisSeverity.MILD,
  })
  severity: DiagnosisSeverity;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /**
   * Chan doan CHINH cua lan kham. Mot ho so co nhieu chan doan thi bao cao phai biet
   * quy lan kham do vao benh nao - chi muc `uq_diagnoses_one_primary` dam bao moi ho
   * so co dung MOT chan doan chinh o tang CSDL, khong phu thuoc vao tang ung dung.
   */
  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;
}
