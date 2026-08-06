import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';

/**
 * Phan tinh toan THUAN cua co bat thuong - P9-T5, SRS FR-13-02.
 *
 * Tach khoi service cung ly do voi `vaccination-schedule.util.ts`: day la mot phep
 * quyet dinh y te nho nhung co nhieu bien (thieu can duoi, thieu can tren, thieu ca
 * hai, gia tri nam dung tren bien), va khong can CSDL de kiem chung.
 */

/** Khoang tham chieu cua mot chi so. `null` = khong biet can do. */
export interface ReferenceRange {
  referenceMin: number | null;
  referenceMax: number | null;
}

/**
 * Tinh co bat thuong tu gia tri va khoang tham chieu.
 *
 * BIEN LA BINH THUONG: WBC 17.0 tren khoang 6-17 la NORMAL, khong phai HIGH. Khoang
 * tham chieu in tren phieu may xet nghiem la khoang DONG o ca hai dau; coi bien la bat
 * thuong se lam moi ket qua nam dung o dau khoang bi to do vo co.
 *
 * KHONG CO KHOANG THAM CHIEU thi tra `NORMAL` chu khong phai `null`: co the co chi so
 * khong ai dinh nghia khoang (mot phep do dinh luong thuan tuy), va de trong o `flag`
 * se bat giao dien phai xu ly them mot trang thai "khong biet" ma khong ai doc duoc gi
 * tu no. Thieu MOT dau van tinh duoc mot phia - chi so chi co can tren thi duoi can la
 * binh thuong.
 *
 * Khong bao gio tra `CRITICAL` - xem ghi chu o `LabResultFlag`.
 */
export function computeLabResultFlag(value: number, range: ReferenceRange): LabResultFlag {
  if (range.referenceMin !== null && value < range.referenceMin) {
    return LabResultFlag.LOW;
  }
  if (range.referenceMax !== null && value > range.referenceMax) {
    return LabResultFlag.HIGH;
  }
  return LabResultFlag.NORMAL;
}

/** Khoang tham chieu nguoc dau la du lieu nhap sai, khong phai mot khoang rong hop le. */
export function isValidReferenceRange(range: ReferenceRange): boolean {
  return (
    range.referenceMin === null ||
    range.referenceMax === null ||
    range.referenceMin <= range.referenceMax
  );
}
