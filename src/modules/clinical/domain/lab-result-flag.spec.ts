import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';
import { computeLabResultFlag, isValidReferenceRange } from './lab-result-flag.util';

/**
 * Test cho phep gan co bat thuong - acceptance P9-T5: "Nhap WBC = 25 voi khoang 6-17
 * -> flag = HIGH tu dong".
 */
describe('lab-result-flag.util', () => {
  describe('computeLabResultFlag', () => {
    const wbc = { referenceMin: 6, referenceMax: 17 };

    it('tren can tren la HIGH - acceptance P9-T5', () => {
      expect(computeLabResultFlag(25, wbc)).toBe(LabResultFlag.HIGH);
    });

    it('duoi can duoi la LOW', () => {
      expect(computeLabResultFlag(3.2, wbc)).toBe(LabResultFlag.LOW);
    });

    it('trong khoang la NORMAL', () => {
      expect(computeLabResultFlag(10.4, wbc)).toBe(LabResultFlag.NORMAL);
    });

    it('nam dung tren bien van la NORMAL', () => {
      // Khoang tham chieu in tren phieu may la khoang DONG. Coi bien la bat thuong se to
      // do moi ket qua nam dung o dau khoang.
      expect(computeLabResultFlag(6, wbc)).toBe(LabResultFlag.NORMAL);
      expect(computeLabResultFlag(17, wbc)).toBe(LabResultFlag.NORMAL);
    });

    it('chi co can tren thi duoi can van la NORMAL', () => {
      expect(computeLabResultFlag(0.1, { referenceMin: null, referenceMax: 1 })).toBe(
        LabResultFlag.NORMAL,
      );
      expect(computeLabResultFlag(2, { referenceMin: null, referenceMax: 1 })).toBe(
        LabResultFlag.HIGH,
      );
    });

    it('khong co khoang tham chieu thi NORMAL, khong phai mot trang thai thu ba', () => {
      expect(computeLabResultFlag(999, { referenceMin: null, referenceMax: null })).toBe(
        LabResultFlag.NORMAL,
      );
    });

    it('khong bao gio tu sinh ra CRITICAL', () => {
      // `CRITICAL` la phan doan lam sang, chi den tu viec ghi de bang tay.
      const flags = [-100, 0, 6, 17, 25, 10_000].map((value) => computeLabResultFlag(value, wbc));
      expect(flags).not.toContain(LabResultFlag.CRITICAL);
    });
  });

  describe('isValidReferenceRange', () => {
    it('can duoi lon hon can tren la du lieu nhap sai', () => {
      expect(isValidReferenceRange({ referenceMin: 17, referenceMax: 6 })).toBe(false);
    });

    it('khoang mot diem (min = max) van hop le', () => {
      expect(isValidReferenceRange({ referenceMin: 7.4, referenceMax: 7.4 })).toBe(true);
    });

    it('thieu mot dau hoac ca hai deu hop le', () => {
      expect(isValidReferenceRange({ referenceMin: null, referenceMax: 6 })).toBe(true);
      expect(isValidReferenceRange({ referenceMin: 6, referenceMax: null })).toBe(true);
      expect(isValidReferenceRange({ referenceMin: null, referenceMax: null })).toBe(true);
    });
  });
});
