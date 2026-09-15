
export enum QueueStatus {
  
  WAITING = 'WAITING',
  
  ASSIGNED = 'ASSIGNED',
  
  IN_ROOM = 'IN_ROOM',
  
  DONE = 'DONE',
  
  CANCELLED = 'CANCELLED',
}

export const ACTIVE_QUEUE_STATUSES: QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.ASSIGNED,
  QueueStatus.IN_ROOM,
];

export const TERMINAL_QUEUE_STATUSES: ReadonlySet<QueueStatus> = new Set([
  QueueStatus.DONE,
  QueueStatus.CANCELLED,
]);

export enum QueueSource {
  
  APPOINTMENT = 'APPOINTMENT',
  
  WALK_IN = 'WALK_IN',
}

const NON_TERMINAL_ORDER: Record<
  Exclude<QueueStatus, QueueStatus.DONE | QueueStatus.CANCELLED>,
  number
> = {
  [QueueStatus.WAITING]: 0,
  [QueueStatus.ASSIGNED]: 1,
  [QueueStatus.IN_ROOM]: 2,
};

export function isValidQueueStatusTransition(from: QueueStatus, to: QueueStatus): boolean {
  if (from === to) return true;
  if (TERMINAL_QUEUE_STATUSES.has(from)) return false;
  if (TERMINAL_QUEUE_STATUSES.has(to)) return true;

  return (
    NON_TERMINAL_ORDER[to as keyof typeof NON_TERMINAL_ORDER] >
    NON_TERMINAL_ORDER[from as keyof typeof NON_TERMINAL_ORDER]
  );
}
