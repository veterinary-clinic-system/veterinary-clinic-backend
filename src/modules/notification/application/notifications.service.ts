import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThan, LessThanOrEqual, Repository } from 'typeorm';
import { format } from 'date-fns';
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
  /** Lịch tái khám (có `parentAppointmentId`) - đổi lời nhắc cho đúng ngữ cảnh. */
  isFollowUp?: boolean;
}

export interface NotifyNowParams {
  appointment: Appointment;
  type: NotificationType;
  recipientPhone: string;
  recipientEmail?: string | null;
  message: string;
}

export interface AppointmentConfirmationParams {
  appointment: Appointment;
  recipientPhone: string;
  recipientEmail?: string | null;
  petName: string;
  branchName: string;
  branchAddress?: string | null;
  serviceName?: string | null;
  isFollowUp?: boolean;
}

export interface VaccinationReminderParams {
  petName: string;
  vaccineName: string;
  diseasePrevented?: string | null;
  nextDueDate: string;
  recipientPhone: string;
  recipientEmail?: string | null;
}

export interface ChannelDelivery {
  channel: NotificationChannel;
  /** Số điện thoại (Zalo) hoặc địa chỉ email (Gmail) đã nhận. */
  recipient: string;
  status: NotificationStatus;
  error: string | null;
}

export interface DeliveryReport {
  /** NOTIFICATION_PROVIDER=log: chỉ ghi log, khách không thật sự nhận được. */
  simulated: boolean;
  deliveries: ChannelDelivery[];
}

const MAX_SEND_ATTEMPTS = 5;
const HOUR_MS = 60 * 60 * 1000;
const LAST_CALL_REMINDER_HOURS = 2;

const SUBJECT_BY_TYPE: Record<NotificationType, string> = {
  [NotificationType.APPOINTMENT_CONFIRMED]: 'Xác nhận lịch hẹn khám',
  [NotificationType.APPOINTMENT_REMINDER]: 'Nhắc lịch hẹn khám',
  [NotificationType.APPOINTMENT_UPDATED]: 'Lịch hẹn của bạn có thay đổi',
  [NotificationType.APPOINTMENT_CANCELLED]: 'Lịch hẹn của bạn đã bị hủy',
};

/** Giờ hẹn theo giờ máy chủ - cùng quy ước với AvailabilityService khi sinh slot. */
export function formatAppointmentTime(date: Date): string {
  return format(date, "HH:mm 'ngày' dd/MM/yyyy");
}

/**
 * Kênh gửi tới KHÁCH HÀNG: Zalo theo số điện thoại (luôn có), cộng Gmail khi khách có
 * email. Mỗi kênh là một dòng `notifications` riêng nên trạng thái/lượt thử lại của
 * kênh này không kéo theo kênh kia (Zalo hỏng không làm email bị gửi lại).
 */
export function customerChannels(recipientEmail?: string | null): NotificationChannel[] {
  return recipientEmail
    ? [NotificationChannel.ZALO, NotificationChannel.EMAIL]
    : [NotificationChannel.ZALO];
}

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
    isFollowUp = false,
  }: ScheduleReminderParams): Promise<Notification[]> {
    const scheduledFor = this.reminderTime(appointment.startAt);
    // Lịch đặt sát giờ: khách vừa nhận tin xác nhận, nhắc thêm ngay lập tức chỉ là trùng.
    if (!scheduledFor) return [];

    const message = isFollowUp
      ? `Nhắc lịch TÁI KHÁM: bé ${petName} có lịch tái khám tại phòng khám thú y lúc ` +
        `${formatAppointmentTime(appointment.startAt)}. Tái khám đúng hẹn giúp bác sĩ đánh giá ` +
        'hiệu quả điều trị. Vui lòng đến đúng giờ.'
      : `Nhắc lịch: bé ${petName} có lịch hẹn tại phòng khám thú y lúc ` +
        `${formatAppointmentTime(appointment.startAt)}. Vui lòng đến đúng giờ.`;

    return this.notificationsRepository.save(
      customerChannels(recipientEmail).map((channel) =>
        this.notificationsRepository.create({
          appointmentId: appointment.id,
          type: NotificationType.APPOINTMENT_REMINDER,
          channel,
          recipientPhone,
          recipientEmail: recipientEmail ?? null,
          message,
          status: NotificationStatus.PENDING,
          scheduledFor,
        }),
      ),
    );
  }

  /**
   * Giờ gửi lời nhắc: trước giờ hẹn `reminderLeadHours` (mặc định 24h). Nếu mốc đó đã qua
   * (đặt lịch cho sáng mai lúc chiều nay) thì lùi về 2 giờ trước giờ hẹn; nếu cả mốc đó
   * cũng đã qua thì không nhắc nữa. Trước đây mốc đã qua vẫn được lưu nguyên, nên cron 5
   * phút sau gửi "nhắc lịch" ngay sau tin xác nhận.
   */
  private reminderTime(startAt: Date, now: Date = new Date()): Date | null {
    const leadHours = this.configService.get<number>('notification.reminderLeadHours') ?? 24;
    const preferred = new Date(startAt.getTime() - leadHours * HOUR_MS);
    if (preferred.getTime() > now.getTime()) return preferred;
    const lastCall = new Date(startAt.getTime() - LAST_CALL_REMINDER_HOURS * HOUR_MS);
    return lastCall.getTime() > now.getTime() ? lastCall : null;
  }

  /**
   * Bỏ các lời nhắc CHƯA gửi của một lịch hẹn - gọi khi lịch bị hủy/không đến hoặc đổi
   * giờ. Không có bước này, cron vẫn gửi lời nhắc với GIỜ CŨ cho một lịch đã đổi, hoặc
   * nhắc khách đến khám một lịch đã hủy.
   */
  async cancelPendingReminders(appointmentId: string): Promise<void> {
    await this.notificationsRepository.delete({
      appointmentId,
      type: NotificationType.APPOINTMENT_REMINDER,
      status: In([NotificationStatus.PENDING, NotificationStatus.FAILED]),
    });
  }

  async notifyNow({
    appointment,
    type,
    recipientPhone,
    recipientEmail,
    message,
  }: NotifyNowParams): Promise<DeliveryReport> {
    const notifications = await this.notificationsRepository.save(
      customerChannels(recipientEmail).map((channel) =>
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
      ),
    );

    const sent: Notification[] = [];
    for (const notification of notifications) {
      sent.push(await this.dispatch(notification));
    }

    return {
      simulated: this.providerRegistry.isSimulated(),
      deliveries: sent.map((n) => ({
        channel: n.channel,
        recipient:
          n.channel === NotificationChannel.EMAIL ? (n.recipientEmail ?? '') : n.recipientPhone,
        status: n.status,
        error: n.errorMessage,
      })),
    };
  }

  /** Xác nhận ngay khi đặt lịch (cả lịch khám thường lẫn lịch tái khám). */
  confirmAppointment(params: AppointmentConfirmationParams): Promise<DeliveryReport> {
    const code = params.appointment.id.slice(0, 8).toUpperCase();
    const kind = params.isFollowUp ? 'lịch TÁI KHÁM' : 'lịch hẹn khám';
    const message =
      `[VetCare] Xác nhận ${kind} cho bé ${params.petName}.\n` +
      `- Thời gian: ${formatAppointmentTime(params.appointment.startAt)}\n` +
      `- Chi nhánh: ${params.branchName}` +
      (params.branchAddress ? ` (${params.branchAddress})` : '') +
      '\n' +
      `- Dịch vụ: ${params.serviceName ?? 'Khám tổng quát'}\n` +
      `- Mã lịch hẹn: #${code}\n` +
      'Vui lòng đưa bé đến đúng giờ. Cần đổi lịch, quý khách vui lòng liên hệ phòng khám.';

    return this.notifyNow({
      appointment: params.appointment,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      recipientPhone: params.recipientPhone,
      recipientEmail: params.recipientEmail,
      message,
    });
  }

  /**
   * Nhắc lịch tiêm gửi thẳng qua nhà cung cấp, không qua bảng `notifications` - bảng đó
   * bắt buộc `appointment_id`, còn mũi tiêm đến hạn chưa gắn với lịch hẹn nào. Chống gửi
   * trùng là việc của người gọi (VaccinationReminderService chỉ gửi cho sự kiện outbox
   * vừa được ghi lần đầu).
   */
  async sendVaccinationReminder(params: VaccinationReminderParams): Promise<DeliveryReport> {
    const subject = `Nhắc lịch tiêm vắc-xin cho bé ${params.petName}`;
    const message =
      `[VetCare] Nhắc lịch tiêm phòng cho bé ${params.petName}.\n` +
      `- Mũi tiêm: ${params.vaccineName}` +
      (params.diseasePrevented ? ` (phòng ${params.diseasePrevented})` : '') +
      '\n' +
      `- Ngày đến hạn: ${params.nextDueDate}\n` +
      'Tiêm đúng hẹn giúp bé phòng các bệnh truyền nhiễm nguy hiểm. Quý khách vui lòng đặt lịch ' +
      'hoặc liên hệ phòng khám.';

    const deliveries: ChannelDelivery[] = [];
    for (const channel of customerChannels(params.recipientEmail)) {
      const recipient =
        channel === NotificationChannel.EMAIL
          ? (params.recipientEmail ?? '')
          : params.recipientPhone;
      try {
        const result = await this.providerRegistry.resolve(channel).send({
          channel,
          recipientPhone: params.recipientPhone,
          recipientEmail: params.recipientEmail,
          message,
          subject,
        });
        deliveries.push({
          channel,
          recipient,
          status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          error: result.error ?? null,
        });
      } catch (error) {
        deliveries.push({
          channel,
          recipient,
          status: NotificationStatus.FAILED,
          error: (error as Error).message,
        });
      }
    }

    return { simulated: this.providerRegistry.isSimulated(), deliveries };
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
    let result;
    try {
      result = await provider.send({
        channel: notification.channel,
        recipientPhone: notification.recipientPhone,
        recipientEmail: notification.recipientEmail,
        message: notification.message,
        subject: SUBJECT_BY_TYPE[notification.type],
      });
    } catch (error) {
      result = { success: false, error: (error as Error).message };
    }

    notification.attemptCount += 1;
    notification.status = result.success ? NotificationStatus.SENT : NotificationStatus.FAILED;
    notification.sentAt = result.success ? new Date() : null;
    notification.errorMessage = result.error ?? null;

    if (!result.success) {
      const remaining = MAX_SEND_ATTEMPTS - notification.attemptCount;
      this.logger.warn(
        `Notification ${notification.id} (${notification.channel}) failed (lần ` +
          `${notification.attemptCount}/${MAX_SEND_ATTEMPTS}` +
          `${remaining > 0 ? ', sẽ thử lại' : ', hết lượt thử'}): ${result.error}`,
      );
    }

    return this.notificationsRepository.save(notification);
  }
}
