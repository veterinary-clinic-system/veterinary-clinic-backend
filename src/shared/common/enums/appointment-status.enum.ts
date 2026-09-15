
export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export const SLOT_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

export const TERMINAL_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
]);

const NON_TERMINAL_ORDER: Record<
  Exclude<
    AppointmentStatus,
    AppointmentStatus.COMPLETED | AppointmentStatus.CANCELLED | AppointmentStatus.NO_SHOW
  >,
  number
> = {
  [AppointmentStatus.PENDING]: 0,
  [AppointmentStatus.CONFIRMED]: 1,
  [AppointmentStatus.CHECKED_IN]: 2,
  [AppointmentStatus.IN_PROGRESS]: 3,
};

const CHECKED_IN_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
]);

export function isValidAppointmentStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): boolean {
  if (from === to) return true;
  if (TERMINAL_APPOINTMENT_STATUSES.has(from)) return false;
  if (to === AppointmentStatus.COMPLETED) return CHECKED_IN_STATUSES.has(from);
  if (TERMINAL_APPOINTMENT_STATUSES.has(to)) return true;

  return (
    NON_TERMINAL_ORDER[to as keyof typeof NON_TERMINAL_ORDER] >
    NON_TERMINAL_ORDER[from as keyof typeof NON_TERMINAL_ORDER]
  );
}
