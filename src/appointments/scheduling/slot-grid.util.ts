export const DEFAULT_SLOT_MINUTES = 30;

export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

/** Minutes since midnight for an "HH:mm" string. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Intersection of two [start,end) minute ranges, or null if they don't overlap. */
export function intersectRanges(a: TimeRange, b: TimeRange): TimeRange | null {
  const start = Math.max(toMinutes(a.start), toMinutes(b.start));
  const end = Math.min(toMinutes(a.end), toMinutes(b.end));
  return start < end ? { start: toHHmm(start), end: toHHmm(end) } : null;
}

/**
 * Splits a [start,end) range into fixed-length slots, dropping a trailing remainder
 * shorter than `slotMinutes`. With the Section 5.1 default of 07:00-11:00 +
 * 13:30-17:30 at 30-minute slots, this yields the mandated 8 + 8 = 16 slots/day.
 */
export function generateSlots(range: TimeRange, slotMinutes = DEFAULT_SLOT_MINUTES): TimeRange[] {
  const slots: TimeRange[] = [];
  let cursor = toMinutes(range.start);
  const end = toMinutes(range.end);

  while (cursor + slotMinutes <= end) {
    slots.push({ start: toHHmm(cursor), end: toHHmm(cursor + slotMinutes) });
    cursor += slotMinutes;
  }

  return slots;
}

export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}
