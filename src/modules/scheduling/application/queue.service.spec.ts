import { ConflictException } from '@nestjs/common';
import { QueueService } from './queue.service';
import { DayAvailability, SlotInfo, SlotStatus } from './availability.service';

/**
 * Test cho `QueueService.findNextFreeStart` - ham chon khung gio khi le tan gan bac si
 * cho mot luot cho.
 *
 * KHONG dung CSDL: ham chi doc ket qua cua `AvailabilityService` roi tinh toan tren
 * mang slot, nen mot doi tuong gia dung mot phuong thuc la du. Cac phan con lai cua
 * `QueueService` (cap so thu tu co khoa, dong bo trang thai trong transaction) phai co
 * CSDL that moi kiem chung duoc - do la viec cua test tich hop, khong phai cua file nay.
 *
 * Day la ham de sai nhat trong module: luoi slot la 30 phut nhung dich vu co the dai
 * hon, nen phai kiem tra MOI slot ma khoang [start, start+duration) cham vao - khong
 * chi rieng slot dau tien.
 */
describe('QueueService.findNextFreeStart', () => {
  /** 04/08/2026 08:00 gio may chu - moc "hien tai" cua moi test ben duoi. */
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

  /** Luoi 30 phut tu `from`, moi phan tu cua `statuses` la mot o. */
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

    // Chi `availabilityService` duoc dung trong duong di nay; cac tham so con lai chua
    // bao gio bi cham toi nen truyen null la du va lam ro dieu do.
    return new QueueService(
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      availabilityService as never,
      null as never,
    );
  }

  /** `findNextFreeStart` la private - goi qua chi so de khoi phai noi long kieu cua lop. */
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
    // 07:00 va 07:30 deu trong nhung da qua (bay gio la 08:00) -> phai chon 08:00.
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
      // 09:00 trong nhung 09:30 da co nguoi -> ca 60 phut khong vao duoc o 09:00.
      // Cap trong lien ke dau tien la 10:00-11:00.
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
      // Chi con dung mot o trong o cuoi ngay - khong du cho dich vu 60 phut.
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
