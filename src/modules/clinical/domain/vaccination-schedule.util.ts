

export interface VaccineSchedule {
  
  doseCount: number;
  
  intervalDays: number | null;
  
  boosterIntervalDays: number | null;
}

export function toDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(from: Date, days: number): string {
  const result = new Date(from.getTime());
  result.setDate(result.getDate() + days);
  return toDateOnly(result);
}

export function computeNextDueDate(
  schedule: VaccineSchedule,
  doseNumber: number,
  vaccinatedAt: Date,
): string | null {
  const withinCourse = doseNumber < schedule.doseCount;

  if (withinCourse) {

    return schedule.intervalDays ? addDays(vaccinatedAt, schedule.intervalDays) : null;
  }

  return schedule.boosterIntervalDays ? addDays(vaccinatedAt, schedule.boosterIntervalDays) : null;
}

export type VaccinationDueStatus = 'OVERDUE' | 'DUE_SOON' | 'SCHEDULED' | 'NONE';

export function classifyDueDate(
  nextDueDate: string | null,
  today: string,
  dueSoonDays = 30,
): VaccinationDueStatus {
  if (!nextDueDate) {
    return 'NONE';
  }
  if (nextDueDate < today) {
    return 'OVERDUE';
  }
  const threshold = addDays(new Date(`${today}T00:00:00`), dueSoonDays);
  return nextDueDate <= threshold ? 'DUE_SOON' : 'SCHEDULED';
}
