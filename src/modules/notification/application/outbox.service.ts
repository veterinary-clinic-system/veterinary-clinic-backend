import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from '@/modules/notification/domain/entities/outbox-event.entity';

export interface RecordOutboxEventParams {
  type: string;
  payload: Record<string, unknown>;

  dedupeKey: string;
}

@Injectable()
export class OutboxService {
  /**
   * Trả về `true` khi dòng THẬT SỰ được ghi, `false` khi trùng `dedupeKey` (ON CONFLICT DO
   * NOTHING). Người gọi dùng giá trị này để chỉ làm việc "một lần" - ví dụ gửi nhắc lịch
   * tiêm cho khách đúng một lần dù cron quét lại mũi tiêm đó nhiều ngày liền.
   */
  async record(manager: EntityManager, params: RecordOutboxEventParams): Promise<boolean> {
    const result = await manager
      .createQueryBuilder()
      .insert()
      .into(OutboxEvent)
      .values({
        type: params.type,

        payload: params.payload as unknown as Record<string, never>,
        dedupeKey: params.dedupeKey,
      })

      .orIgnore()
      .returning('id')
      .execute();

    return Array.isArray(result.raw) && result.raw.length > 0;
  }
}
