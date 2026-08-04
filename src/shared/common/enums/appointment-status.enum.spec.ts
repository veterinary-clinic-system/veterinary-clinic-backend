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

  it('cho phep tu trang thai chua ket thuc di thang toi bat ky trang thai ket thuc nao', () => {
    const nonTerminal = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.IN_PROGRESS,
    ];
    const terminal = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ];

    for (const from of nonTerminal) {
      for (const to of terminal) {
        expect(isValidAppointmentStatusTransition(from, to)).toBe(true);
      }
    }
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
