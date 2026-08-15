import { QueueService } from './queue.service';
import { DayAvailability, SlotInfo, SlotStatus } from './availability.service';

/**
 * Test cho `QueueService.findEarliestFreeDoctorSlot` - buoc "tu xep bac si" khi le tan
 * tao mot luot khach vang lai ma khong chi dinh ai.
 *
 * Phan hoi nghiem thu: "khi dien form thi nen chon luon thoi gian cho khach neu co bac
 * si trong va thoi gian trong. Trong truong hop het bac si va thoi gian thi moi dua vao
 * hang cho." Hai nhanh do chinh la hai nhom test ben duoi.
 *
 * KHONG dung CSDL: ham chi doc `AvailabilityService` va danh sach bac si roi tinh tren
 * mang slot - cung ly le voi `queue.service.spec.ts`.
 */
describe('QueueService.findEarliestFreeDoctorSlot', () => {
  /** 04/08/2026 08:00 gio may chu - moc "hien tai" cua moi test ben duoi. */
  const NOW = new Date(2026, 7, 4, 8, 0, 0);
  const DATE_STR = '2026-08-04';

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.setSystemTime(NOW));

  /** Luoi 30 phut tu `fromHour`, moi phan tu cua `statuses` la mot o. */
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

  /**
   * `doctorDays` anh xa doctorId -> luoi slot cua bac si do trong ngay. Chi
   * `doctorsRepository` va `availabilityService` duoc dung trong duong di nay.
   */
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
          // `null` = chi nhanh dong cua voi bac si nay (khong co luoi nao ca).
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

  /** Ham la private - goi qua chi so de khoi phai noi long kieu cua lop. */
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
      // BS A ban toi 10:00; BS B trong ngay tu 09:00.
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
      // BS A trong luc 09:00 nhung 09:30 da co nguoi -> ca 60 phut khong vao duoc.
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
    // Bay gio la 08:00 - hai o 07:00/07:30 tuy trong nhung da qua.
    const service = makeService({
      'doctor-a': grid(7, [SlotStatus.FREE, SlotStatus.FREE, SlotStatus.FREE]),
    });

    await expect(findEarliest(service, 30)).resolves.toEqual({
      doctorId: 'doctor-a',
      startAt: new Date(`${DATE_STR}T08:00:00`),
    });
  });
});
