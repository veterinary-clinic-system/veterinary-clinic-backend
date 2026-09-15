import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { Notification } from '@/modules/notification/domain/entities/notification.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@/shared/common/enums/notification.enum';
import {
  NOTIFICATION_DISPATCHER,
  NotificationDispatcher,
} from '@/modules/notification/application/ports/notification.port';

export interface ScheduleReminderParams {
  appointment: Appointment;
  recipientPhone: string;
  
  recipientEmail?: string | null;
  petName: string;
}

export interface NotifyNowParams {
  appointment: Appointment;
  type: NotificationType;
  recipientPhone: string;
  recipientEmail?: string | null;
  message: string;
  channel?: NotificationChannel;
}

const MAX_SEND_ATTEMPTS = 5;

const SUBJECT_BY_TYPE: Record<NotificationType, string> = {
  [NotificationType.APPOINTMENT_REMINDER]: 'Nhắc lịch hẹn khám',
  [NotificationType.APPOINTMENT_UPDATED]: 'Lịch hẹn của bạn có thay đổi',
  [NotificationType.APPOINTMENT_CANCELLED]: 'Lịch hẹn của bạn đã bị hủy',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @Inject(NOTIFICATION_DISPATCHER)
    private readonly providerRegistry: NotificationDispatcher,
    private readonly configService: ConfigService,
  ) {}

  async scheduleAppointmentReminder({
    appointment,
    recipientPhone,
    recipientEmail,
    petName,
  }: ScheduleReminderParams): Promise<Notification> {
    const leadHours = this.configService.get<number>('notification.reminderLeadHours') ?? 24;
    const scheduledFor = new Date(appointment.startAt.getTime() - leadHours * 60 * 60 * 1000);

    const message =
      `Nhắc lịch: ${petName} có lịch hẹn tại phòng khám thú y vào lúc ` +
      `${appointment.startAt.toLocaleString('vi-VN')}. Vui lòng đến đúng giờ.`;

    return this.notificationsRepository.save(
      this.notificationsRepository.create({
        appointmentId: appointment.id,
        type: NotificationType.APPOINTMENT_REMINDER,
        channel: NotificationChannel.SMS,
        recipientPhone,
        recipientEmail: recipientEmail ?? null,
        message,
        status: NotificationStatus.PENDING,
        scheduledFor,
      }),
    );
  }

  async notifyNow({
    appointment,
    type,
    recipientPhone,
    recipientEmail,
    message,
    channel = NotificationChannel.SMS,
  }: NotifyNowParams): Promise<Notification> {
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        appointmentId: appointment.id,
        type,
        channel,
        recipientPhone,
        recipientEmail: recipientEmail ?? null,
        message,
        status: NotificationStatus.PENDING,
        scheduledFor: new Date(),
      }),
    );

    return this.dispatch(notification);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueNotifications(): Promise<void> {
    const now = new Date();
    const due = await this.notificationsRepository.find({
      where: [
        { status: NotificationStatus.PENDING, scheduledFor: LessThanOrEqual(now) },
        {
          status: NotificationStatus.FAILED,
          scheduledFor: LessThanOrEqual(now),
          attemptCount: LessThan(MAX_SEND_ATTEMPTS),
        },
      ],
      take: 100,
    });

    for (const notification of due) {
      await this.dispatch(notification);
    }
  }

  private async dispatch(notification: Notification): Promise<Notification> {
    const provider = this.providerRegistry.resolve(notification.channel);
    const result = await provider.send({
      recipientPhone: notification.recipientPhone,
      recipientEmail: notification.recipientEmail,
      message: notification.message,
      subject: SUBJECT_BY_TYPE[notification.type],
    });

    notification.attemptCount += 1;
    notification.status = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
    notification.sentAt = result.success ? new Date() : null;
    notification.errorMessage = result.error ?? null;

    if (!result.success) {
      const remaining = MAX_SEND_ATTEMPTS - notification.attemptCount;
      this.logger.warn(
        `Notification ${notification.id} failed (lần ${notification.attemptCount}/${MAX_SEND_ATTEMPTS}` +
          `${remaining > 0 ? ', sẽ thử lại' : ', hết lượt thử'}): ${result.error}`,
      );
    }

    return this.notificationsRepository.save(notification);
  }
}
