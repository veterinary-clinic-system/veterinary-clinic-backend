import { NotificationsService, customerChannels } from './notifications.service';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@/shared/common/enums/notification.enum';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';

describe('NotificationsService', () => {
  const sent: Array<{ channel?: string; recipientEmail?: string | null }> = [];
  const provider = {
    send: jest.fn((message) => {
      sent.push(message);
      return Promise.resolve(
        message.channel === NotificationChannel.EMAIL
          ? { success: false, error: 'SMTP_HOST chưa được cấu hình' }
          : { success: true },
      );
    }),
  };
  const registry = { resolve: jest.fn(() => provider), isSimulated: jest.fn(() => false) };
  const repository = {
    create: jest.fn((value) => ({ attemptCount: 0, ...value })),
    save: jest.fn((value) => Promise.resolve(value)),
    delete: jest.fn(),
  };
  const config = { get: jest.fn(() => 24) };
  const push = { hasDevicesForPhone: jest.fn(() => Promise.resolve(false)) };
  const inbox = { record: jest.fn(() => Promise.resolve()) };
  const service = new NotificationsService(
    repository as never,
    registry as never,
    config as never,
    push as never,
    inbox as never,
  );
  const appointment = { id: 'abcdef12-aaaa', startAt: new Date(2026, 9, 16, 9, 0) } as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
    sent.length = 0;
  });

  it('kênh khách hàng: Zalo luôn có, Gmail khi có email', () => {
    expect(customerChannels(null)).toEqual([NotificationChannel.ZALO]);
    expect(customerChannels('a@b.vn')).toEqual([
      NotificationChannel.ZALO,
      NotificationChannel.EMAIL,
    ]);
  });

  it('thêm kênh PUSH khi chủ nuôi có máy đã đăng ký, kèm đường dẫn mở lịch hẹn', async () => {
    push.hasDevicesForPhone.mockResolvedValueOnce(true);
    await service.confirmAppointment({
      appointment,
      recipientPhone: '0912345678',
      recipientEmail: null,
      petName: 'Milu',
      branchName: 'Quận 7',
    });

    expect(repository.create.mock.calls.map(([n]) => n.channel)).toEqual([
      NotificationChannel.ZALO,
      NotificationChannel.PUSH,
    ]);
    const pushed = provider.send.mock.calls.find(([m]) => m.channel === NotificationChannel.PUSH);
    expect(pushed?.[0].url).toBe('/appointments/abcdef12-aaaa');
  });

  it('xác nhận lịch: mỗi kênh một dòng, báo cáo đúng trạng thái từng kênh', async () => {
    const report = await service.confirmAppointment({
      appointment,
      recipientPhone: '0912345678',
      recipientEmail: 'an@gmail.com',
      petName: 'Milu',
      branchName: 'Quận 7',
      serviceName: 'Khám tổng quát',
    });

    expect(repository.create).toHaveBeenCalledTimes(2);
    expect(repository.create.mock.calls.map(([n]) => n.type)).toEqual([
      NotificationType.APPOINTMENT_CONFIRMED,
      NotificationType.APPOINTMENT_CONFIRMED,
    ]);
    expect(sent[0].channel).toBe(NotificationChannel.ZALO);
    expect(report.deliveries).toEqual([
      {
        channel: NotificationChannel.ZALO,
        recipient: '0912345678',
        status: NotificationStatus.SENT,
        error: null,
      },
      {
        channel: NotificationChannel.EMAIL,
        recipient: 'an@gmail.com',
        status: NotificationStatus.FAILED,
        error: 'SMTP_HOST chưa được cấu hình',
      },
    ]);
  });

  it('nhắc lịch tái khám: lời nhắc đúng ngữ cảnh, lên lịch trước giờ hẹn', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 10, 8, 0));
    const rows = await service.scheduleAppointmentReminder({
      appointment,
      recipientPhone: '0912345678',
      recipientEmail: null,
      petName: 'Milu',
      isFollowUp: true,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain('TÁI KHÁM');
    expect(rows[0].scheduledFor).toEqual(new Date(2026, 9, 15, 9, 0));
    expect(provider.send).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('mốc 24h đã qua: lùi về 2h trước giờ hẹn; sát giờ quá thì không nhắc', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 15, 15, 0));
    const rows = await service.scheduleAppointmentReminder({
      appointment,
      recipientPhone: '0912345678',
      petName: 'Milu',
    });
    expect(rows[0].scheduledFor).toEqual(new Date(2026, 9, 16, 7, 0));

    jest.setSystemTime(new Date(2026, 9, 16, 8, 0));
    await expect(
      service.scheduleAppointmentReminder({
        appointment,
        recipientPhone: '0912345678',
        petName: 'Milu',
      }),
    ).resolves.toEqual([]);
    jest.useRealTimers();
  });

  it('huỷ lời nhắc chưa gửi của một lịch hẹn', async () => {
    await service.cancelPendingReminders('appt-1');
    expect(repository.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 'appt-1',
        type: NotificationType.APPOINTMENT_REMINDER,
      }),
    );
  });

  it('nhắc lịch tiêm gửi thẳng qua Zalo + Gmail', async () => {
    const report = await service.sendVaccinationReminder({
      petName: 'Milu',
      vaccineName: 'Vắc-xin dại',
      nextDueDate: '2026-10-20',
      recipientPhone: '0912345678',
      recipientEmail: 'an@gmail.com',
    });
    expect(report.deliveries.map((d) => d.channel)).toEqual([
      NotificationChannel.ZALO,
      NotificationChannel.EMAIL,
    ]);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('hộp thông báo: mọi kênh của cùng một thông báo dùng chung một dedupe key', async () => {
    await service.confirmAppointment({
      appointment,
      recipientPhone: '0912345678',
      recipientEmail: 'an@gmail.com',
      petName: 'Milu',
      branchName: 'Quận 7',
    });

    expect(inbox.record).toHaveBeenCalledTimes(2);
    const keys = new Set(
      inbox.record.mock.calls.map(([p]: never[]) => (p as { dedupeKey: string }).dedupeKey),
    );
    expect(keys.size).toBe(1);
    expect(inbox.record.mock.calls[0]).toEqual([
      expect.objectContaining({
        recipientPhone: '0912345678',
        type: 'APPOINTMENT_CONFIRMED',
        title: 'Xác nhận lịch hẹn khám',
        link: '/appointments/abcdef12-aaaa',
      }),
    ]);
  });

  it('tin tài khoản (mã khôi phục) gửi qua Zalo + Gmail, không qua push', async () => {
    push.hasDevicesForPhone.mockResolvedValue(true);
    const report = await service.sendAccountMessage({
      recipientPhone: '0912345678',
      recipientEmail: 'an@gmail.com',
      subject: 'Mã khôi phục',
      message: 'Mã của bạn là 123456',
    });
    push.hasDevicesForPhone.mockResolvedValue(false);

    expect(report.deliveries.map((d) => d.channel)).toEqual([
      NotificationChannel.ZALO,
      NotificationChannel.EMAIL,
    ]);
    expect(repository.save).not.toHaveBeenCalled();
    expect(inbox.record).not.toHaveBeenCalled();
  });
});
