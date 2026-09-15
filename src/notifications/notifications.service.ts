import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Appointment, Notification } from '@/database/entities';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@/common/enums/notification.enum';
import { NotificationProviderRegistry } from './providers/notification-provider.registry';

// Exported (not just declared) because `declaration: true` (tsconfig) requires every
// type used in an exported class's public method signature to be nameable in the
// emitted .d.ts - see the same fix in appointments.service.ts for the return-type version.
export interface ScheduleReminderParams {
  appointment: Appointment;
  recipientPhone: string;
  petName: string;
}

export interface NotifyNowParams {
  appointment: Appointment;
  type: NotificationType;
  recipientPhone: string;
  message: string;
  channel?: NotificationChannel;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly providerRegistry: NotificationProviderRegistry,
    private readonly configService: ConfigService,
  ) {}

  /** Queues a reminder for `reminderLeadHours` (default 24h) before the appointment. */
  async scheduleAppointmentReminder({
    appointment,
    recipientPhone,
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
        message,
        status: NotificationStatus.PENDING,
        scheduledFor,
      }),
    );
  }

  /** Sends immediately (booking adjustments, cancellations) instead of queuing. */
  async notifyNow({
    appointment,
    type,
    recipientPhone,
    message,
    channel = NotificationChannel.SMS,
  }: NotifyNowParams): Promise<Notification> {
    const notification = await this.notificationsRepository.save(
      this.notificationsRepository.create({
        appointmentId: appointment.id,
        type,
        channel,
        recipientPhone,
        message,
        status: NotificationStatus.PENDING,
        scheduledFor: new Date(),
      }),
    );

    return this.dispatch(notification);
  }

  /** Section 5.3: "the triggering logic (scheduled reminder...) must be real and testable." */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueNotifications(): Promise<void> {
    const due = await this.notificationsRepository.find({
      where: { status: NotificationStatus.PENDING, scheduledFor: LessThanOrEqual(new Date()) },
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
      message: notification.message,
    });

    notification.status = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
    notification.sentAt = result.success ? new Date() : null;
    notification.errorMessage = result.error ?? null;

    if (!result.success) {
      this.logger.warn(`Notification ${notification.id} failed: ${result.error}`);
    }

    return this.notificationsRepository.save(notification);
  }
}
