import {
  VaccineSchedule,
  addDays,
  classifyDueDate,
  computeNextDueDate,
  toDateOnly,
} from './vaccination-schedule.util';

/**
 * Test cho phan tinh toan thuan cua lich tiem chung - acceptance P9-T2 ("nextDueDate tu
 * tinh tu intervalDays / boosterIntervalDays") va P9-T3 (to do / to vang).
 *
 * KHONG dung CSDL. Phan con lai cua `VaccinationsService` (transaction, tru kho, BR-11)
 * can Postgres that moi kiem chung duoc - do la viec cua smoke test bang API that.
 */
describe('vaccination-schedule.util', () => {
  const TODAY = '2026-08-06';

  function schedule(over: Partial<VaccineSchedule> = {}): VaccineSchedule {
    return { doseCount: 1, intervalDays: null, boosterIntervalDays: null, ...over };
  }

  describe('computeNextDueDate', () => {
    it('con trong phac do thi hen theo intervalDays', () => {
      // Phac do 3 mui cach nhau 21 ngay, vua tiem mui 1.
      const next = computeNextDueDate(
        schedule({ doseCount: 3, intervalDays: 21, boosterIntervalDays: 365 }),
        1,
        new Date('2026-08-06T09:00:00'),
      );
      expect(next).toBe('2026-08-27');
    });

    it('mui cuoi cua phac do thi hen theo boosterIntervalDays, khong phai intervalDays', () => {
      // Cho de lan nhat: mui 3 cua phac do 3 mui phai nhac lai sau MOT NAM, khong phai
      // sau 21 ngay nua.
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
      // Mot mui den han HOM NAY chua bi bo lo - to do no la bao dong nham.
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
      // Quan trong voi Viet Nam (UTC+7): 23:00 ngay 06/08 gio VN la 16:00 UTC cung ngay,
      // nhung 00:30 ngay 07/08 gio VN lai la 17:30 ngay 06/08 UTC. Dung `toISOString()`
      // thi mot mui tiem luc nua dem se roi vao ngay hom truoc.
      expect(toDateOnly(new Date('2026-08-07T00:30:00'))).toBe('2026-08-07');
    });
  });
});
