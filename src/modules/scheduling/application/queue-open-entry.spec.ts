import { ConflictException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { QueueService } from './queue.service';
import { QueueStatus } from '@/shared/common/enums/queue-status.enum';

describe('QueueService - luot cho dang mo chi tinh trong ngay', () => {
  const NOW = new Date(2026, 9, 16, 9, 0, 0);
  const TODAY = '2026-10-16';

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.setSystemTime(NOW));

  function makeService(openEntryToday: { ticketNumber: number } | null) {
    const queueRepository = {
      findOne: jest.fn().mockResolvedValue(openEntryToday),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const dataSource = {
      transaction: jest.fn().mockResolvedValue({ id: 'entry-new', queueDate: TODAY }),
    };
    const realtimeGateway = { emitQueueChanged: jest.fn(), emitAppointmentChanged: jest.fn() };

    const service = new QueueService(
      queueRepository as never,
      null as never,
      null as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'service-1', durationMinutes: 30 }) } as never,
      { findOne: jest.fn().mockResolvedValue({ id: 'branch-1' }) } as never,
      dataSource as never,
      null as never,
      {
        resolveOwner: jest.fn().mockResolvedValue({ id: 'owner-1' }),
        resolvePet: jest.fn().mockResolvedValue({ id: 'pet-1', name: 'Milo' }),
      } as never,
      null as never,
      realtimeGateway as never,
    );
    return { service, queueRepository, dataSource, realtimeGateway };
  }

  const walkInDto = {
    branchId: 'branch-1',
    serviceId: 'service-1',
    phone: '0900000099',
    ownerFullName: 'Chu nuoi',
    doctorId: 'doctor-1',
  };
  const actor = { userId: 'user-1' };

  it('vang lai: chi tim luot dang mo cua chinh ngay hom nay', async () => {
    const { service, queueRepository, dataSource } = makeService(null);
    const assigned = { id: 'entry-new' };
    jest.spyOn(service, 'assignDoctor').mockResolvedValue(assigned as never);

    await expect(service.createWalkIn(walkInDto as never, actor as never)).resolves.toBe(assigned);

    const where = queueRepository.findOne.mock.calls[0][0].where;
    expect(where).toMatchObject({ petId: 'pet-1', queueDate: TODAY });
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('vang lai: van chan khi thu cung con luot mo trong cung ngay', async () => {
    const { service, dataSource } = makeService({ ticketNumber: 3 });

    await expect(service.createWalkIn(walkInDto as never, actor as never)).rejects.toThrow(
      new ConflictException('Milo đang có một lượt chờ chưa kết thúc (số thứ tự 3).'),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('check-in lich hen: luot mo cua ngay khac khong chan', async () => {
    const { service, queueRepository } = makeService(null);
    const appointment = {
      id: 'appt-1',
      petId: 'pet-1',
      pet: { name: 'Luna' },
      branchId: 'branch-1',
      doctorId: 'doctor-1',
      status: 'CONFIRMED',
      startAt: NOW,
    };
    (service as unknown as { appointmentsRepository: unknown }).appointmentsRepository = {
      findOne: jest.fn().mockResolvedValue(appointment),
    };
    (service as unknown as { availabilityService: unknown }).availabilityService = {
      invalidateDoctorDay: jest.fn(),
    };
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'entry-new' } as never);

    await service.checkIn({ appointmentId: 'appt-1' } as never, actor as never);

    const petLookup = queueRepository.findOne.mock.calls[1][0].where;
    expect(petLookup).toMatchObject({ petId: 'pet-1', queueDate: TODAY });
  });

  describe('closeStaleEntries', () => {
    it('IN_ROOM ngay cu -> DONE, WAITING/ASSIGNED ngay cu -> CANCELLED', async () => {
      const { service, queueRepository, realtimeGateway } = makeService(null);
      queueRepository.update
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 3 });

      await expect(service.closeStaleEntries()).resolves.toBe(4);

      const [doneWhere, donePatch] = queueRepository.update.mock.calls[0];
      expect((doneWhere.queueDate as FindOperator<string>).type).toBe('lessThan');
      expect((doneWhere.queueDate as FindOperator<string>).value).toBe(TODAY);
      expect(doneWhere.status).toBe(QueueStatus.IN_ROOM);
      expect(donePatch).toMatchObject({ status: QueueStatus.DONE, finishedAt: NOW });

      const [cancelWhere, cancelPatch] = queueRepository.update.mock.calls[1];
      expect((cancelWhere.queueDate as FindOperator<string>).value).toBe(TODAY);
      expect((cancelWhere.status as FindOperator<QueueStatus[]>).value).toEqual([
        QueueStatus.WAITING,
        QueueStatus.ASSIGNED,
      ]);
      expect(cancelPatch).toMatchObject({ status: QueueStatus.CANCELLED, finishedAt: NOW });
      expect(cancelPatch.cancelReason).toBeTruthy();
      expect(realtimeGateway.emitQueueChanged).toHaveBeenCalledTimes(1);
    });

    it('khong co luot ton thi khong phat su kien', async () => {
      const { service, realtimeGateway } = makeService(null);

      await expect(service.closeStaleEntries()).resolves.toBe(0);
      expect(realtimeGateway.emitQueueChanged).not.toHaveBeenCalled();
    });

    it('loi DB luc khoi dong khong lam sap ung dung', async () => {
      const { service, queueRepository } = makeService(null);
      queueRepository.update.mockRejectedValue(new Error('db down'));

      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
