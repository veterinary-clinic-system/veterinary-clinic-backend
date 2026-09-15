
export enum PrescriptionStatus {
  
  PRESCRIBED = 'PRESCRIBED',
  
  DISPENSING = 'DISPENSING',
  
  DISPENSED = 'DISPENSED',
  
  CANCELLED = 'CANCELLED',
}

export const TERMINAL_PRESCRIPTION_STATUSES: ReadonlySet<PrescriptionStatus> = new Set([
  PrescriptionStatus.DISPENSED,
  PrescriptionStatus.CANCELLED,
]);

export const EDITABLE_PRESCRIPTION_STATUSES: ReadonlySet<PrescriptionStatus> = new Set([
  PrescriptionStatus.PRESCRIBED,
]);

const NON_TERMINAL_ORDER: Record<
  Exclude<PrescriptionStatus, PrescriptionStatus.DISPENSED | PrescriptionStatus.CANCELLED>,
  number
> = {
  [PrescriptionStatus.PRESCRIBED]: 0,
  [PrescriptionStatus.DISPENSING]: 1,
};

export function isValidPrescriptionStatusTransition(
  from: PrescriptionStatus,
  to: PrescriptionStatus,
): boolean {
  if (from === to) return true;
  if (TERMINAL_PRESCRIPTION_STATUSES.has(from)) return false;
  if (TERMINAL_PRESCRIPTION_STATUSES.has(to)) return true;

  return (
    NON_TERMINAL_ORDER[to as keyof typeof NON_TERMINAL_ORDER] >
    NON_TERMINAL_ORDER[from as keyof typeof NON_TERMINAL_ORDER]
  );
}
