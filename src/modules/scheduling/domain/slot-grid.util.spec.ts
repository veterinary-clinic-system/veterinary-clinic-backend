import {
  DEFAULT_SLOT_MINUTES,
  generateSlots,
  intersectRanges,
  rangesOverlap,
  toHHmm,
  toMinutes,
} from './slot-grid.util';

/**
 * Test cho tang `domain` - chay KHONG CAN CSDL, khong can Nest TestingModule.
 *
 * Day chinh la thu ma Phan III tai lieu kien truc doi o tang trong cung: logic nghiep
 * vu thuan, kiem chung duoc bang mot ham goi. Neu mot ngay nao do file nay phai mock
 * repository moi chay duoc thi tuc la logic da ro ri xuong duoi tang domain.
 */
describe('slot-grid.util', () => {
  describe('toMinutes / toHHmm', () => {
    it('doi qua lai giu nguyen gia tri', () => {
      expect(toMinutes('00:00')).toBe(0);
      expect(toMinutes('07:30')).toBe(450);
      expect(toMinutes('23:59')).toBe(1439);

      expect(toHHmm(0)).toBe('00:00');
      expect(toHHmm(450)).toBe('07:30');
      expect(toHHmm(1439)).toBe('23:59');
    });

    it('luon dem 2 chu so - "07:05" chu khong phai "7:5"', () => {
      expect(toHHmm(toMinutes('07:05'))).toBe('07:05');
    });
  });

  describe('generateSlots', () => {
    it('sinh dung 8 + 8 = 16 khung gio/ngay theo muc 5.1 tai lieu', () => {
      const sang = generateSlots({ start: '07:00', end: '11:00' });
      const chieu = generateSlots({ start: '13:30', end: '17:30' });

      expect(sang).toHaveLength(8);
      expect(chieu).toHaveLength(8);
      expect(sang[0]).toEqual({ start: '07:00', end: '07:30' });
      expect(sang[7]).toEqual({ start: '10:30', end: '11:00' });
      expect(chieu[0]).toEqual({ start: '13:30', end: '14:00' });
      expect(chieu[7]).toEqual({ start: '17:00', end: '17:30' });
    });

    it('bo phan du cuoi ngan hon mot khung - khong sinh khung 10 phut', () => {
      expect(generateSlots({ start: '07:00', end: '08:10' })).toEqual([
        { start: '07:00', end: '07:30' },
        { start: '07:30', end: '08:00' },
      ]);
    });

    it('khung gio lien tiep khop dau-duoi, khong ho va khong chong', () => {
      const slots = generateSlots({ start: '07:00', end: '11:00' });

      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].start).toBe(slots[i - 1].end);
      }
    });

    it('tra ve rong khi khoang ngan hon mot khung hoac dao nguoc', () => {
      expect(generateSlots({ start: '07:00', end: '07:20' })).toEqual([]);
      expect(generateSlots({ start: '11:00', end: '07:00' })).toEqual([]);
    });

    it('ton trong do dai khung truyen vao, mac dinh la 30 phut', () => {
      expect(DEFAULT_SLOT_MINUTES).toBe(30);
      expect(generateSlots({ start: '07:00', end: '08:00' }, 15)).toHaveLength(4);
      expect(generateSlots({ start: '07:00', end: '08:00' }, 60)).toHaveLength(1);
    });
  });

  describe('intersectRanges', () => {
    it('tra ve phan giao khi hai khoang cat nhau', () => {
      expect(
        intersectRanges({ start: '07:00', end: '11:00' }, { start: '09:00', end: '13:00' }),
      ).toEqual({
        start: '09:00',
        end: '11:00',
      });
    });

    it('tra ve null khi roi nhau', () => {
      expect(
        intersectRanges({ start: '07:00', end: '11:00' }, { start: '13:30', end: '17:30' }),
      ).toBeNull();
    });

    it('tra ve null khi chi cham nhau tai mot diem - khoang la nua mo [start, end)', () => {
      expect(
        intersectRanges({ start: '07:00', end: '11:00' }, { start: '11:00', end: '13:00' }),
      ).toBeNull();
    });
  });

  describe('rangesOverlap', () => {
    it('hai lich hen ke sat nhau KHONG bi coi la trung', () => {
      expect(
        rangesOverlap({ start: '09:00', end: '09:30' }, { start: '09:30', end: '10:00' }),
      ).toBe(false);
    });

    it('nhan ra trung khi mot lich long trong lich kia', () => {
      expect(
        rangesOverlap({ start: '09:00', end: '10:00' }, { start: '09:15', end: '09:45' }),
      ).toBe(true);
    });

    it('nhan ra trung khi hai lich chi phu nhau mot phan', () => {
      expect(
        rangesOverlap({ start: '09:00', end: '09:45' }, { start: '09:30', end: '10:15' }),
      ).toBe(true);
    });

    it('doi xung: doi cho hai tham so khong doi ket qua', () => {
      const a = { start: '09:00', end: '09:45' };
      const b = { start: '09:30', end: '10:15' };
      expect(rangesOverlap(a, b)).toBe(rangesOverlap(b, a));
    });
  });
});
