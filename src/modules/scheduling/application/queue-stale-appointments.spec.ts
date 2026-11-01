import { FindOperator } from 'typeorm';
import { QueueService, startOfVietnamDay } from './queue.service';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';

describe('QueueService - tu dong lich hen cua cac ngay truoc', () => {
  // 01/11/2026 01:30 UTC = 08:30 gio Viet Nam.
  const NOW = new Date(Date.UTC(2026, 10, 1, 1, 30));
  // 00:00 01/11 gio Viet Nam = 17:00 31/10 UTC.
  const VN_MIDNIGHT = new Date(Date.UTC(2026, 9, 31, 17, 0));

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.setSystemTime(NOW));

  function makeService() {
    const appointmentsRepository = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
    const realtimeGateway = { emitQueueChanged: jest.fn(), emitAppointmentChanged: jest.fn() };
    const service = new QueueService(
      null as never,
      appointmentsRepository as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      realtimeGateway as never,
    );
    return { service, appointmentsRepository, realtimeGateway };
  }

  it('moc la 00:00 gio Viet Nam, khong phai 00:00 cua may chu UTC', () => {
    expect(startOfVietnamDay(NOW)).toEqual(VN_MIDNIGHT);
    // 23:30 gio Viet Nam (16:30 UTC) van thuoc cung ngay Viet Nam.
    expect(startOfVietnamDay(new Date(Date.UTC(2026, 10, 1, 16, 30)))).toEqual(VN_MIDNIGHT);
  });

  it('PENDING ngay cu -> CANCELLED, CONFIRMED ngay cu -> NO_SHOW', async () => {
    const { service, appointmentsRepository, realtimeGateway } = makeService();
    appointmentsRepository.update
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 2 });

    await expect(service.closeStaleAppointments()).resolves.toBe(3);

    const [pendingWhere, pendingPatch] = appointmentsRepository.update.mock.calls[0];
    expect((pendingWhere.startAt as FindOperator<Date>).type).toBe('lessThan');
    expect((pendingWhere.startAt as FindOperator<Date>).value).toEqual(VN_MIDNIGHT);
    expect(pendingWhere.status).toBe(AppointmentStatus.PENDING);
    expect(pendingPatch).toMatchObject({ status: AppointmentStatus.CANCELLED, cancelledAt: NOW });
    expect(pendingPatch.cancelReason).toBeTruthy();

    const [confirmedWhere, confirmedPatch] = appointmentsRepository.update.mock.calls[1];
    expect((confirmedWhere.startAt as FindOperator<Date>).value).toEqual(VN_MIDNIGHT);
    expect(confirmedWhere.status).toBe(AppointmentStatus.CONFIRMED);
    expect(confirmedPatch).toMatchObject({ status: AppointmentStatus.NO_SHOW, cancelledAt: NOW });
    expect(realtimeGateway.emitAppointmentChanged).toHaveBeenCalledTimes(1);
  });

  it('khong co lich ton thi khong phat su kien', async () => {
    const { service, realtimeGateway } = makeService();

    await expect(service.closeStaleAppointments()).resolves.toBe(0);
    expect(realtimeGateway.emitAppointmentChanged).not.toHaveBeenCalled();
  });
});
