import {
  ACTIVE_QUEUE_STATUSES,
  QueueStatus,
  TERMINAL_QUEUE_STATUSES,
  isValidQueueStatusTransition,
} from './queue-status.enum';

describe('isValidQueueStatusTransition', () => {
  const ALL = [
    QueueStatus.WAITING,
    QueueStatus.ASSIGNED,
    QueueStatus.IN_ROOM,
    QueueStatus.DONE,
    QueueStatus.CANCELLED,
  ];

  const MATRIX: Record<QueueStatus, Record<QueueStatus, boolean>> = {
    [QueueStatus.WAITING]: {
      [QueueStatus.WAITING]: true,
      [QueueStatus.ASSIGNED]: true,
      [QueueStatus.IN_ROOM]: true,
      [QueueStatus.DONE]: true,
      [QueueStatus.CANCELLED]: true,
    },
    [QueueStatus.ASSIGNED]: {
      [QueueStatus.WAITING]: false, 
      [QueueStatus.ASSIGNED]: true,
      [QueueStatus.IN_ROOM]: true,
      [QueueStatus.DONE]: true,
      [QueueStatus.CANCELLED]: true,
    },
    [QueueStatus.IN_ROOM]: {
      [QueueStatus.WAITING]: false,
      [QueueStatus.ASSIGNED]: false,
      [QueueStatus.IN_ROOM]: true,
      [QueueStatus.DONE]: true,
      [QueueStatus.CANCELLED]: true,
    },
    
    [QueueStatus.DONE]: {
      [QueueStatus.WAITING]: false,
      [QueueStatus.ASSIGNED]: false,
      [QueueStatus.IN_ROOM]: false,
      [QueueStatus.DONE]: true,
      [QueueStatus.CANCELLED]: false,
    },
    [QueueStatus.CANCELLED]: {
      [QueueStatus.WAITING]: false,
      [QueueStatus.ASSIGNED]: false,
      [QueueStatus.IN_ROOM]: false,
      [QueueStatus.DONE]: false,
      [QueueStatus.CANCELLED]: true,
    },
  };

  it.each(ALL)('tu %s chuyen dung theo ma tran', (from) => {
    for (const to of ALL) {
      expect({ from, to, allowed: isValidQueueStatusTransition(from, to) }).toEqual({
        from,
        to,
        allowed: MATRIX[from][to],
      });
    }
  });

  it('giu nguyen trang thai luon hop le - PATCH chi doi ghi chu van gui kem status', () => {
    for (const status of ALL) {
      expect(isValidQueueStatusTransition(status, status)).toBe(true);
    }
  });

  it('hai tap trang thai khong giao nhau va phu het enum', () => {
    for (const status of ALL) {
      const isActive = ACTIVE_QUEUE_STATUSES.includes(status);
      const isTerminal = TERMINAL_QUEUE_STATUSES.has(status);
      expect(isActive).toBe(!isTerminal);
    }
  });
});
