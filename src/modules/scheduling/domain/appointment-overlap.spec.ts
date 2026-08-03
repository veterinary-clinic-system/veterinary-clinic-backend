import { ConflictException } from '@nestjs/common';

import { isAppointmentOverlapError, mapAppointmentOverlapError } from './appointment-overlap';

/**
 * Rang buoc EXCLUDE `appointment_no_overlap` (migration 1785000000000) la lop chan
 * trung lich CUOI CUNG - no chan duoc ca truong hop hai request chen vao cung mot khe
 * thoi gian giua luc doc va luc INSERT.
 *
 * Test o day khoa chat phan DICH loi: chi dung cap ma loi + ten rang buoc moi thanh
 * 409. Neu ai do doi ten rang buoc trong migration ma quen sua o day, luong se lang
 * le tro lai thanh 500 - nen phai co test giu.
 */
describe('appointment-overlap', () => {
  const overlapError = { code: '23P01', constraint: 'appointment_no_overlap' };

  describe('isAppointmentOverlapError', () => {
    it('nhan ra dung loi vi pham rang buoc chong lich', () => {
      expect(isAppointmentOverlapError(overlapError)).toBe(true);
    });

    it('bo qua loi CSDL khac dung ten rang buoc do', () => {
      expect(
        isAppointmentOverlapError({ code: '23505', constraint: 'appointment_no_overlap' }),
      ).toBe(false);
    });

    it('bo qua vi pham EXCLUDE cua rang buoc khac', () => {
      expect(
        isAppointmentOverlapError({ code: '23P01', constraint: 'doctor_shift_no_overlap' }),
      ).toBe(false);
    });

    it('khong nem khi nhan null, undefined hay Error thuong', () => {
      expect(isAppointmentOverlapError(null)).toBe(false);
      expect(isAppointmentOverlapError(undefined)).toBe(false);
      expect(isAppointmentOverlapError(new Error('mat ket noi'))).toBe(false);
    });
  });

  describe('mapAppointmentOverlapError', () => {
    it('tra ve nguyen ket qua khi khong co loi', async () => {
      await expect(mapAppointmentOverlapError(async () => 'da dat lich')).resolves.toBe(
        'da dat lich',
      );
    });

    it('doi loi trung lich thanh 409 Conflict co thong bao cho nguoi dung', async () => {
      const promise = mapAppointmentOverlapError(async () => {
        throw overlapError;
      });

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('Khung gio nay vua co nguoi dat');
    });

    it('nem lai nguyen ven moi loi khac - khong nuot loi ha tang', async () => {
      const loiKhac = new Error('connection terminated unexpectedly');

      await expect(
        mapAppointmentOverlapError(async () => {
          throw loiKhac;
        }),
      ).rejects.toBe(loiKhac);
    });
  });
});
