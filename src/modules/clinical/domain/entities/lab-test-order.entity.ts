import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { MedicalRecord } from './medical-record.entity';
import { LaboratoryResult } from './laboratory-result.entity';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';

/**
 * Not in diagram.jpg - added for prompt.md Section 4.1.4 ("order lab tests").
 *
 * Khoa ngoai la `medical_record_id` tu P4-T6 - cung ly do voi `Prescription`: khoi
 * "Laboratory" cua SRS thuoc ve ho so benh an, khong thuoc rieng phan sinh hieu.
 *
 * Tu P9-T5, KET QUA co hai tang song song: `results` (bang chi so co cau truc, dung de
 * ve xu huong o P9-T6) va `resultText`/`resultFileUrls` (ket qua dinh tinh va file
 * PDF/anh - FR-13-03). Khong cai nao thay the cai nao, xem `laboratory-result.entity.ts`.
 */
@Entity({ name: 'lab_test_orders' })
export class LabTestOrder extends BaseEntity {
  @ManyToOne(() => MedicalRecord, (record) => record.labTestOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id' })
  medicalRecordId: string;

  @Column({ name: 'test_name', length: 255 })
  testName: string;

  @Column({ type: 'enum', enum: LabTestStatus, default: LabTestStatus.ORDERED })
  status: LabTestStatus;

  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string | null;

  @Column({ name: 'result_file_urls', type: 'text', array: true, default: [] })
  resultFileUrls: string[];

  // -------------------------------------------------------------- P9-T5 (FR-13)

  /**
   * Ky thuat vien da tra ket qua. Nullable: yeu cau vua chi dinh thi chua co ai tra, va
   * du lieu truoc P9 khong co thong tin nay.
   *
   * Tro toi `users` chu khong `employees`: nguoi tra ket qua co the la bac si tu lam
   * (phong kham nho), va bac si khong nhat thiet co ban ghi nhan su tuong ung.
   */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'technician_user_id' })
  technician: User | null;

  @Column({ name: 'technician_user_id', type: 'uuid', nullable: true })
  technicianUserId: string | null;

  /**
   * Thoi diem CO KET QUA, khac `createdAt` (thoi diem chi dinh).
   *
   * Hai moc nay cach nhau that su - ket qua sinh hoa thuong ve sau vai gio, ket qua gui
   * ngoai vien vai ngay - va P9-T6 ve bieu do xu huong theo moc NAY: mot chi so phai
   * nam dung ngay no duoc do, khong phai ngay bac si nghi den viec do no.
   */
  @Column({ name: 'result_date', type: 'timestamptz', nullable: true })
  resultDate: Date | null;

  @OneToMany(() => LaboratoryResult, (result) => result.labTestOrder)
  results?: LaboratoryResult[];
}
