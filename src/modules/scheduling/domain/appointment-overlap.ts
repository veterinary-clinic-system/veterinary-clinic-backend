import { ConflictException } from '@nestjs/common';

const PG_EXCLUSION_VIOLATION = '23P01';

const APPOINTMENT_OVERLAP_CONSTRAINT = 'appointment_no_overlap';

export function isAppointmentOverlapError(error: unknown): boolean {
  const candidate = error as { code?: string; constraint?: string } | null;
  return (
    candidate?.code === PG_EXCLUSION_VIOLATION &&
    candidate?.constraint === APPOINTMENT_OVERLAP_CONSTRAINT
  );
}

export async function mapAppointmentOverlapError<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAppointmentOverlapError(error)) {
      throw new ConflictException('Khung gio nay vua co nguoi dat - vui long chon khung gio khac');
    }
    throw error;
  }
}
