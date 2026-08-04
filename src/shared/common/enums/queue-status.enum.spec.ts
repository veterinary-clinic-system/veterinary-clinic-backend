import {
  ACTIVE_QUEUE_STATUSES,
  QueueStatus,
  TERMINAL_QUEUE_STATUSES,
  isValidQueueStatusTransition,
} from './queue-status.enum';

/**
 * Ma tran 5x5 day du cua luat chuyen trang thai luot cho.
 *
 * Vi sao viet ra thanh bang thay vi vai `expect` roi rac: luat nay duoc goi o dung mot
 * cho (`QueueService.update`) nhung quyet dinh toan bo hanh vi cua man hinh quay le
 * tan. Mot bang 5x5 lam moi o hien ro rang - them mot trang thai moi ma quen sua luat
 * se lam bang nay do ngay.
 */
describe('isValidQueueStatusTransition', () => {
  const ALL = [
    QueueStatus.WAITING,
    QueueStatus.ASSIGNED,
    QueueStatus.IN_ROOM,
    QueueStatus.DONE,
    QueueStatus.CANCELLED,
  ];

  // Hang = trang thai hien tai, cot = trang thai muon chuyen sang.
  //            WAITING ASSIGNED IN_ROOM DONE  CANCELLED
  const MATRIX: Record<QueueStatus, Record<QueueStatus, boolean>> = {
    [QueueStatus.WAITING]: {
      [QueueStatus.WAITING]: true,
      [QueueStatus.ASSIGNED]: true,
      [QueueStatus.IN_ROOM]: true,
      [QueueStatus.DONE]: true,
      [QueueStatus.CANCELLED]: true,
    },
    [QueueStatus.ASSIGNED]: {
      [QueueStatus.WAITING]: false, // khong lui
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
    // Da roi hang cho thi khong mo lai duoc bang PATCH.
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
