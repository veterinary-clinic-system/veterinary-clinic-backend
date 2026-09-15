import {
  VaccineSchedule,
  addDays,
  classifyDueDate,
  computeNextDueDate,
  toDateOnly,
} from './vaccination-schedule.util';

describe('vaccination-schedule.util', () => {
  const TODAY = '2026-08-06';

  function schedule(over: Partial<VaccineSchedule> = {}): VaccineSchedule {
    return { doseCount: 1, intervalDays: null, boosterIntervalDays: null, ...over };
  }

  describe('computeNextDueDate', () => {
    it('con trong phac do thi hen theo intervalDays', () => {
      
      const next = computeNextDueDate(
        schedule({ doseCount: 3, intervalDays: 21, boosterIntervalDays: 365 }),
        1,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBe('2026-08-27');
    });

    it('mui cuoi cua phac do thi hen theo boosterIntervalDays, khong phai intervalDays', () => {

      const next = computeNextDueDate(
        schedule({ doseCount: 3, intervalDays: 21, boosterIntervalDays: 365 }),
        3,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBe('2027-08-06');
    });

    it('phac do mot mui thi di thang sang nhac lai', () => {
      const next = computeNextDueDate(
        schedule({ doseCount: 1, boosterIntervalDays: 365 }),
        1,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBe('2027-08-06');
    });

    it('khong khai boosterIntervalDays thi het phac do la het nhac', () => {
      const next = computeNextDueDate(
        schedule({ doseCount: 2, intervalDays: 30 }),
        2,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBeNull();
    });

    it('tiem bu them mot mui ngoai phac do van roi vao nhanh nhac lai', () => {
      const next = computeNextDueDate(
        schedule({ doseCount: 2, intervalDays: 30, boosterIntervalDays: 365 }),
        5,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBe('2027-08-06');
    });

    it('khong doan bua khi phac do nhieu mui ma thieu intervalDays', () => {
      const next = computeNextDueDate(
        schedule({ doseCount: 3, boosterIntervalDays: 365 }),
        1,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBeNull();
    });

    it('cong ngay vuot qua ranh gioi thang va nam nhuan', () => {
      expect(addDays(new Date('2028-02-28T00:00:00'), 1)).toBe('2028-02-29');
      expect(addDays(new Date('2026-12-31T00:00:00'), 1)).toBe('2027-01-01');
    });
  });

  describe('classifyDueDate', () => {
    it('ngay hen da qua la OVERDUE', () => {
      expect(classifyDueDate('2026-08-05', TODAY)).toBe('OVERDUE');
    });

    it('dung hom nay van la DUE_SOON, khong phai OVERDUE', () => {
      
      expect(classifyDueDate(TODAY, TODAY)).toBe('DUE_SOON');
    });

    it('trong nguong 30 ngay la DUE_SOON, ngoai nguong la SCHEDULED', () => {
      expect(classifyDueDate('2026-09-05', TODAY)).toBe('DUE_SOON');
      expect(classifyDueDate('2026-09-06', TODAY)).toBe('SCHEDULED');
    });

    it('khong co hen thi khong to mau gi', () => {
      expect(classifyDueDate(null, TODAY)).toBe('NONE');
    });
  });

  describe('toDateOnly', () => {
    it('dung lich DIA PHUONG chu khong phai UTC', () => {

      expect(toDateOnly(new Date('2026-08-07T00:30:00'))).toBe('2026-08-07');
    });
  });
});
