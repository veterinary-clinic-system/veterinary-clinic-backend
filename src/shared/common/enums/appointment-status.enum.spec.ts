import { AppointmentStatus, isValidAppointmentStatusTransition } from './appointment-status.enum';

/**
 * Bug that this guards against: PATCH /appointments/:id could previously write ANY
 * status straight to the row, including moving a COMPLETED/CANCELLED/NO_SHOW
 * appointment back to an earlier status. These tests lock the fix in place.
 */
describe('isValidAppointmentStatusTransition', () => {
  it('cho phep giu nguyen trang thai bat ky', () => {
    for (const status of Object.values(AppointmentStatus)) {
      expect(isValidAppointmentStatusTransition(status, status)).toBe(true);
    }
  });

  it('chan MOI chuyen tiep ra khoi trang thai da ket thuc', () => {
    const terminal = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ];
    const anyOther = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ];

    for (const from of terminal) {
      for (const to of anyOther) {
        if (to === from) continue;
        expect(isValidAppointmentStatusTransition(from, to)).toBe(false);
      }
    }
  });

  it('cho phep huy / danh vang tu MOI trang thai chua ket thuc', () => {
    const nonTerminal = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.IN_PROGRESS,
    ];

    for (const from of nonTerminal) {
      expect(isValidAppointmentStatusTransition(from, AppointmentStatus.CANCELLED)).toBe(true);
      expect(isValidAppointmentStatusTransition(from, AppointmentStatus.NO_SHOW)).toBe(true);
    }
  });

  // BR-06: "Appointment chi duoc hoan thanh sau khi pet da duoc tiep nhan."
  describe('BR-06 - COMPLETED phai di qua tiep nhan', () => {
    it('chan hoan tat mot lich chua duoc tiep nhan', () => {
      expect(
        isValidAppointmentStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.COMPLETED),
      ).toBe(false);
      expect(
        isValidAppointmentStatusTransition(
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.COMPLETED,
        ),
      ).toBe(false);
    });

    it('cho phep hoan tat sau khi da check-in hoac dang kham', () => {
      expect(
        isValidAppointmentStatusTransition(
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.COMPLETED,
        ),
      ).toBe(true);
      expect(
        isValidAppointmentStatusTransition(
          AppointmentStatus.IN_PROGRESS,
          AppointmentStatus.COMPLETED,
        ),
      ).toBe(true);
    });

    it('luong day du: dat lich -> xac nhan -> check-in -> vao phong -> hoan tat', () => {
      const flow = [
        AppointmentStatus.PENDING,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.COMPLETED,
      ];

      for (let i = 0; i < flow.length - 1; i += 1) {
        expect(isValidAppointmentStatusTransition(flow[i], flow[i + 1])).toBe(true);
      }
    });
  });

  it('cho phep tien ve phia truoc giua cac trang thai chua ket thuc', () => {
    expect(
      isValidAppointmentStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED),
    ).toBe(true);
    expect(
      isValidAppointmentStatusTransition(AppointmentStatus.PENDING, AppointmentStatus.IN_PROGRESS),
    ).toBe(true);
    expect(
      isValidAppointmentStatusTransition(
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.IN_PROGRESS,
      ),
    ).toBe(true);
  });

  it('chan lui giua cac trang thai chua ket thuc', () => {
    expect(
      isValidAppointmentStatusTransition(AppointmentStatus.IN_PROGRESS, AppointmentStatus.PENDING),
    ).toBe(false);
    expect(
      isValidAppointmentStatusTransition(AppointmentStatus.CHECKED_IN, AppointmentStatus.CONFIRMED),
    ).toBe(false);
  });
});
