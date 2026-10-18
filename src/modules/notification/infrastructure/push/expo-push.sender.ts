import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PushMessage,
  PushSenderPort,
  PushTicket,
} from '@/modules/notification/application/ports/push-sender.port';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Giới hạn của Expo cho một lần gọi. */
const BATCH_SIZE = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Gửi push qua Expo Push Service (FCM cho Android, APNs cho iOS ở phía Expo). */
@Injectable()
export class ExpoPushSender extends PushSenderPort {
  private readonly logger = new Logger('NotificationProvider:push');

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      tickets.push(...(await this.sendBatch(messages.slice(i, i + BATCH_SIZE))));
    }
    return tickets;
  }

  private async sendBatch(messages: PushMessage[]): Promise<PushTicket[]> {
    const accessToken = this.configService.get<string>('notification.expoAccessToken');
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(
        messages.map((m) => ({
          to: m.to,
          title: m.title,
          body: m.body,
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          data: m.url ? { url: m.url } : {},
        })),
      ),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Expo push HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const { data } = (await response.json()) as { data: ExpoTicket[] };
    return data.map((ticket) => {
      if (ticket.status === 'ok') return { ok: true };
      const code = ticket.details?.error;
      this.logger.warn(`Expo từ chối push: ${code ?? ''} ${ticket.message ?? ''}`);
      return {
        ok: false,
        deviceGone: code === 'DeviceNotRegistered',
        error: ticket.message ?? code,
      };
    });
  }
}
