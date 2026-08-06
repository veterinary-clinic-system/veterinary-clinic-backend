import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { numericTransformer } from '@/shared/database/transformers/numeric.transformer';
import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';
import { LabTestOrder } from './lab-test-order.entity';

/**
 * Mot CHI SO trong ket qua xet nghiem - SRS FR-13-02 (P9-T5).
 *
 * VI SAO KHONG PHAI MOT O TEXT: truoc P9, ket qua xet nghiem la `LabTestOrder.resultText`
 * - mot doan chu tu do. Doc duoc mot lan, nhung khong tra loi duoc cau hoi ma bac si
 * thuc su can: "WBC cua con nay ba thang qua dang tang hay giam". Mot yeu cau xet nghiem
 * sinh ra NHIEU dong o day (mot cong thuc mau co hang chuc chi so), va chinh vi tung chi
 * so la mot dong rieng ma P9-T6 moi ve duoc bieu do theo thoi gian.
 *
 * `resultText` VA `resultFileUrls` TREN `LabTestOrder` KHONG BI BO. FR-13-03 van doi
 * upload PDF/anh, va nhung ket qua DINH TINH ("Parvo: duong tinh") khong quy ve so duoc
 * thi van ghi o `resultText` - bang chi so nay danh cho phan DINH LUONG. Hai thu hien
 * song song tren giao dien, dung nhu acceptance P9-T5 doi.
 */
@Entity({ name: 'laboratory_results' })
@Index(['labTestOrderId'])
export class LaboratoryResult extends BaseEntity {
  @ManyToOne(() => LabTestOrder, (order) => order.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_test_order_id' })
  labTestOrder: LabTestOrder;

  @Column({ name: 'lab_test_order_id' })
  labTestOrderId: string;

  /**
   * Ten chi so ("WBC", "ALT", "Creatinine").
   *
   * Chuoi tu do chu khong phai khoa ngoai toi mot danh muc chi so: moi may xet nghiem
   * in ra mot bo ten khac nhau, va bat phong kham khai bao truoc toan bo danh muc truoc
   * khi nhap duoc ket qua dau tien la mot rao can khong ai vuot. P9-T6 gom nhom theo
   * chinh chuoi nay, nen no duoc CHUAN HOA VE CHU HOA khi luu - xem `LaboratoriesService`.
   */
  @Column({ name: 'parameter', length: 100 })
  parameter: string;

  /** Gia tri do duoc. Xem ghi chu dau lop ve ket qua dinh tinh. */
  @Column({
    name: 'value',
    type: 'numeric',
    precision: 14,
    scale: 4,
    transformer: numericTransformer,
  })
  value: number;

  /** Don vi ("10^3/uL", "mg/dL"). Nullable: co chi so khong don vi (ty le, chi so mau). */
  @Column({ name: 'unit', type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  /**
   * Khoang tham chieu. CHEP LAI theo tung ket qua chu khong tra cuu tu mot bang chuan:
   * khoang binh thuong cua cho khac meo, cho con khac cho gia, va may xet nghiem nao in
   * khoang cua may do. Chep vao tung dong thi doc lai ho so nam nam sau van thay dung
   * khoang da dung de ket luan hom do.
   */
  @Column({
    name: 'reference_min',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  referenceMin: number | null;

  @Column({
    name: 'reference_max',
    type: 'numeric',
    precision: 14,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  referenceMax: number | null;

  /** Tinh tu dong khi luu tru khi `flagOverridden` - xem `computeLabResultFlag`. */
  @Column({ name: 'flag', type: 'enum', enum: LabResultFlag, default: LabResultFlag.NORMAL })
  flag: LabResultFlag;

  /**
   * Ky thuat vien da ghi de co bat thuong.
   *
   * Can mot CO RIENG chu khong the suy tu "flag khac voi ket qua tinh tu dong": lan luu
   * sau se tinh lai va de len mat ghi de, va nguoi ghi de se thay quyet dinh cua minh
   * bien mat ma khong hieu tai sao. Day cung la duong duy nhat de mot ket qua mang co
   * `CRITICAL`.
   */
  @Column({ name: 'flag_overridden', default: false })
  flagOverridden: boolean;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}
