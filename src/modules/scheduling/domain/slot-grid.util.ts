export const DEFAULT_SLOT_MINUTES = 30;

export interface TimeRange {
  start: string; 
  end: string; 
}

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

export function intersectRanges(a: TimeRange, b: TimeRange): TimeRange | null {
  const start = Math.max(toMinutes(a.start), toMinutes(b.start));
  const end = Math.min(toMinutes(a.end), toMinutes(b.end));
  return start < end ? { start: toHHmm(start), end: toHHmm(end) } : null;
}

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
