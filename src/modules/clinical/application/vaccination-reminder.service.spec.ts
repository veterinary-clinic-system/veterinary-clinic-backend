import { VaccinationReminderService } from './vaccination-reminder.service';

describe('VaccinationReminderService', () => {
  const row = (id: string) => ({
    vaccinationId: id,
    petId: 'p',
    petName: 'Milu',
    ownerId: 'o',
    ownerName: 'An',
    ownerPhone: '0912345678',
    ownerEmail: 'an@gmail.com',
    vaccineName: 'Dại',
    diseasePrevented: 'Dại',
    doseNumber: 1,
    nextDueDate: '2026-10-20',
    branchId: 'b',
  });

  it('chỉ gửi cho khách những mũi tiêm vừa ghi outbox lần đầu (cron quét lại không gửi trùng)', async () => {
    const dataSource = {
      query: jest.fn().mockResolvedValue([row('v-new'), row('v-old')]),
      transaction: jest.fn((work) => work({})),
    };
    const outbox = {
      record: jest.fn((_em, params) =>
        Promise.resolve(params.dedupeKey.startsWith('vacc-due:v-new')),
      ),
    };
    const notifications = { sendVaccinationReminder: jest.fn().mockResolvedValue({}) };
    const service = new VaccinationReminderService(
      dataSource as never,
      outbox as never,
      notifications as never,
    );

    await expect(service.publishDueReminders()).resolves.toBe(2);
    expect(outbox.record).toHaveBeenCalledTimes(2);
    expect(notifications.sendVaccinationReminder).toHaveBeenCalledTimes(1);
    expect(notifications.sendVaccinationReminder).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'an@gmail.com', nextDueDate: '2026-10-20' }),
    );
  });
});
