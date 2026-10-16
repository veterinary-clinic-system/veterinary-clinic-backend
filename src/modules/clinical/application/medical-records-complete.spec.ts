import { FindOperator } from 'typeorm';
import { MedicalRecordsService } from './medical-records.service';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { QueueEntry } from '@/modules/scheduling/domain/entities/queue-entry.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { MedicalRecordStatus } from '@/shared/common/enums/medical-record-status.enum';
import { ACTIVE_QUEUE_STATUSES, QueueStatus } from '@/shared/common/enums/queue-status.enum';

describe('MedicalRecordsService.complete - dong luot cho', () => {
  function makeService(queueAffected: number) {
    const manager = {
      query: jest.fn(),
      findOne: jest.fn((entity: unknown) =>
        Promise.resolve(
          entity === MedicalRecord
            ? { id: 'record-1', appointmentId: 'appt-1', status: MedicalRecordStatus.DRAFT }
            : { id: 'appt-1', status: AppointmentStatus.IN_PROGRESS },
        ),
      ),
      update: jest.fn((entity: unknown) =>
        Promise.resolve({ affected: entity === QueueEntry ? queueAffected : 1 }),
      ),
    };
    const dataSource = {
      transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) => work(manager)),
    };
    const realtimeGateway = { emitQueueChanged: jest.fn() };

    const service = new MedicalRecordsService(
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
      dataSource as never,
      { learnFromConfirmedDiagnoses: jest.fn() } as never,
      realtimeGateway as never,
    );
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ id: 'record-1', diagnoses: [], appointment: {}, pet: {} } as never);
    return { service, manager, realtimeGateway };
  }

  it('chuyen luot cho dang mo cua lich hen sang DONE va bao realtime', async () => {
    const { service, manager, realtimeGateway } = makeService(1);

    await service.complete('record-1');

    const queueCall = manager.update.mock.calls.find(([entity]) => entity === QueueEntry);
    expect(queueCall).toBeDefined();
    const [, where, patch] = queueCall as unknown as [
      unknown,
      { appointmentId: string; status: FindOperator<QueueStatus[]> },
      { status: QueueStatus; finishedAt: Date },
    ];
    expect(where.appointmentId).toBe('appt-1');
    expect(where.status.value).toEqual(ACTIVE_QUEUE_STATUSES);
    expect(patch.status).toBe(QueueStatus.DONE);
    expect(patch.finishedAt).toBeInstanceOf(Date);

    expect(manager.update).toHaveBeenCalledWith(Appointment, 'appt-1', {
      status: AppointmentStatus.COMPLETED,
    });
    expect(realtimeGateway.emitQueueChanged).toHaveBeenCalledTimes(1);
  });

  it('khong co luot cho nao dang mo thi khong phat su kien hang cho', async () => {
    const { service, realtimeGateway } = makeService(0);

    await service.complete('record-1');

    expect(realtimeGateway.emitQueueChanged).not.toHaveBeenCalled();
  });
});
