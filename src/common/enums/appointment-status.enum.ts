/**
 * Not present as an explicit attribute in diagram.jpg's Appointment box, but required to
 * implement Section 4.1.2 (receptionist adjusts bookings, cancellations, no-shows) and the
 * calendar's free/busy logic in Section 5. Documented in CLAUDE.md as an added field.
 */
export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

/** Statuses that still hold the doctor's calendar slot and must block re-booking it. */
export const SLOT_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];
