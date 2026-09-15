import { ConflictException } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DayAvailability, SlotInfo, SlotStatus } from './availability.service';

describe('QueueService.findNextFreeStart', () => {
  
  const NOW = new Date(2026, 7, 4, 8, 0, 0);
  const DATE_STR = '2026-08-04';

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(NOW);
  });

  function slot(start: string, end: string, status: SlotStatus): SlotInfo {
    return {
      start,
      end,
      startAt: new Date(`${DATE_STR}T${start}:00`),
      endAt: new Date(`${DATE_STR}T${end}:00`),
      status,
    };
  }

  function grid(fromHour: number, statuses: SlotStatus[]): SlotInfo[] {
    return statuses.map((status, index) => {
      const startMinutes = fromHour * 60 + index * 30;
      const endMinutes = startMinutes + 30;
      const hhmm = (m: number) =>
        `${Math.floor(m / 60)
          .toString()
          .padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
      return slot(hhmm(startMinutes), hhmm(endMinutes), status);
    });
  }

  function makeService(day: Partial<DayAvailability> & { slots: SlotInfo[] }): QueueService {
    const availabilityService = {
      getDoctorDayAvailability: jest.fn().mockResolvedValue({
        date: DATE_STR,
        dayOfWeek: NOW.getDay(),
        isBranchOpen: true,
        ...day,
      } satisfies DayAvailability),
    };

    return new QueueService(
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      availabilityService as never,
      null as never,
      null as never,
    );
  }

  function findNextFreeStart(service: QueueService, durationMinutes: number): Promise<Date> {
    return (
      service as unknown as {
        findNextFreeStart(doctorId: string, branchId: string, duration: number): Promise<Date>;
      }
    ).findNextFreeStart('doctor-1', 'branch-1', durationMinutes);
  }

  it('chon o trong dau tien con lai trong ngay', async () => {
    const service = makeService({
      slots: grid(9, [SlotStatus.FREE, SlotStatus.FREE]),
    });

    await expect(findNextFreeStart(service, 30)).resolves.toEqual(new Date(`${DATE_STR}T09:00:00`));
  });

  it('bo qua o da troi qua gio hien tai', async () => {
    
    const service = makeService({
      slots: grid(7, [SlotStatus.FREE, SlotStatus.FREE, SlotStatus.FREE]),
    });

    await expect(findNextFreeStart(service, 30)).resolves.toEqual(new Date(`${DATE_STR}T08:00:00`));
  });

  it('bo qua o dang ban / ngoai ca / gio nghi', async () => {
    const service = makeService({
      slots: grid(9, [SlotStatus.BOOKED, SlotStatus.BREAK, SlotStatus.OFF_SHIFT, SlotStatus.FREE]),
    });

    await expect(findNextFreeStart(service, 30)).resolves.toEqual(new Date(`${DATE_STR}T10:30:00`));
  });

  describe('dich vu dai hon mot slot', () => {
    it('doi HAI o lien ke deu trong voi dich vu 60 phut', async () => {

      const service = makeService({
        slots: grid(9, [SlotStatus.FREE, SlotStatus.BOOKED, SlotStatus.FREE, SlotStatus.FREE]),
      });

      await expect(findNextFreeStart(service, 60)).resolves.toEqual(
        new Date(`${DATE_STR}T10:00:00`),
      );
    });

    it('doi BA o lien ke voi dich vu 90 phut', async () => {
      const service = makeService({
        slots: grid(9, [
          SlotStatus.FREE,
          SlotStatus.FREE,
          SlotStatus.BREAK,
          SlotStatus.FREE,
          SlotStatus.FREE,
          SlotStatus.FREE,
        ]),
      });

      await expect(findNextFreeStart(service, 90)).resolves.toEqual(
        new Date(`${DATE_STR}T10:30:00`),
      );
    });

    it('tu choi khi khong con du o lien ke o cuoi ngay', async () => {
      
      const service = makeService({
        slots: grid(9, [SlotStatus.BOOKED, SlotStatus.FREE]),
      });

      await expect(findNextFreeStart(service, 60)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('tu choi khi khong con o trong nao', async () => {
    const service = makeService({
      slots: grid(9, [SlotStatus.BOOKED, SlotStatus.BOOKED]),
    });

    await expect(findNextFreeStart(service, 30)).rejects.toThrow(
      /không còn khung giờ trống nào hôm nay/i,
    );
  });

  it('tu choi khi chi nhanh khong mo cua hom nay', async () => {
    const service = makeService({ isBranchOpen: false, slots: [] });

    await expect(findNextFreeStart(service, 30)).rejects.toThrow(/không mở cửa hôm nay/i);
  });
});
