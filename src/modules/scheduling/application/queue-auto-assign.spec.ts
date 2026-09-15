import { QueueService } from './queue.service';
import { DayAvailability, SlotInfo, SlotStatus } from './availability.service';

describe('QueueService.findEarliestFreeDoctorSlot', () => {
  
  const NOW = new Date(2026, 7, 4, 8, 0, 0);
  const DATE_STR = '2026-08-04';

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.setSystemTime(NOW));

  function grid(fromHour: number, statuses: SlotStatus[]): SlotInfo[] {
    return statuses.map((status, index) => {
      const startMinutes = fromHour * 60 + index * 30;
      const hhmm = (m: number) =>
        `${Math.floor(m / 60)
          .toString()
          .padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
      const start = hhmm(startMinutes);
      const end = hhmm(startMinutes + 30);
      return {
        start,
        end,
        startAt: new Date(`${DATE_STR}T${start}:00`),
        endAt: new Date(`${DATE_STR}T${end}:00`),
        status,
      };
    });
  }

  function makeService(doctorDays: Record<string, SlotInfo[] | null>): QueueService {
    const doctorsRepository = {
      find: jest.fn().mockResolvedValue(Object.keys(doctorDays).map((id) => ({ id }))),
    };

    const availabilityService = {
      getDoctorDayAvailability: jest.fn((doctorId: string) => {
        const slots = doctorDays[doctorId];
        return Promise.resolve({
          date: DATE_STR,
          dayOfWeek: NOW.getDay(),
          
          isBranchOpen: slots !== null,
          slots: slots ?? [],
        } satisfies DayAvailability);
      }),
    };

    return new QueueService(
      null as never,
      null as never,
      doctorsRepository as never,
      null as never,
      null as never,
      null as never,
      availabilityService as never,
      null as never,
      null as never,
    );
  }

  function findEarliest(
    service: QueueService,
    durationMinutes: number,
  ): Promise<{ doctorId: string; startAt: Date } | null> {
    return (
      service as unknown as {
        findEarliestFreeDoctorSlot(
          branchId: string,
          duration: number,
        ): Promise<{ doctorId: string; startAt: Date } | null>;
      }
    ).findEarliestFreeDoctorSlot('branch-1', durationMinutes);
  }

  it('chon bac si co khung trong SOM NHAT, khong phai bac si dau danh sach', async () => {
    const service = makeService({
      
      'doctor-a': grid(9, [SlotStatus.BOOKED, SlotStatus.BOOKED, SlotStatus.FREE]),
      'doctor-b': grid(9, [SlotStatus.FREE, SlotStatus.FREE, SlotStatus.FREE]),
    });

    await expect(findEarliest(service, 30)).resolves.toEqual({
      doctorId: 'doctor-b',
      startAt: new Date(`${DATE_STR}T09:00:00`),
    });
  });

  it('bo qua bac si ngoai ca / dang nghi', async () => {
    const service = makeService({
      'doctor-a': grid(9, [SlotStatus.OFF_SHIFT, SlotStatus.BREAK]),
      'doctor-b': grid(9, [SlotStatus.BOOKED, SlotStatus.FREE]),
    });

    await expect(findEarliest(service, 30)).resolves.toEqual({
      doctorId: 'doctor-b',
      startAt: new Date(`${DATE_STR}T09:30:00`),
    });
  });

  it('ton trong thoi luong dich vu khi so sanh giua cac bac si', async () => {
    const service = makeService({
      
      'doctor-a': grid(9, [SlotStatus.FREE, SlotStatus.BOOKED, SlotStatus.FREE]),
      'doctor-b': grid(9, [SlotStatus.BOOKED, SlotStatus.FREE, SlotStatus.FREE]),
    });

    await expect(findEarliest(service, 60)).resolves.toEqual({
      doctorId: 'doctor-b',
      startAt: new Date(`${DATE_STR}T09:30:00`),
    });
  });

  it('tra ve null khi CA CHI NHANH het cho - luot cho nam lai o hang cho', async () => {
    const service = makeService({
      'doctor-a': grid(9, [SlotStatus.BOOKED, SlotStatus.BOOKED]),
      'doctor-b': grid(9, [SlotStatus.BOOKED, SlotStatus.OFF_SHIFT]),
    });

    await expect(findEarliest(service, 30)).resolves.toBeNull();
  });

  it('tra ve null khi chi nhanh khong mo cua hom nay', async () => {
    const service = makeService({ 'doctor-a': null });

    await expect(findEarliest(service, 30)).resolves.toBeNull();
  });

  it('tra ve null khi chi nhanh chua co bac si nao', async () => {
    const service = makeService({});

    await expect(findEarliest(service, 30)).resolves.toBeNull();
  });

  it('bo qua khung gio da troi qua gio hien tai', async () => {
    
    const service = makeService({
      'doctor-a': grid(7, [SlotStatus.FREE, SlotStatus.FREE, SlotStatus.FREE]),
    });

    await expect(findEarliest(service, 30)).resolves.toEqual({
      doctorId: 'doctor-a',
      startAt: new Date(`${DATE_STR}T08:00:00`),
    });
  });
});
