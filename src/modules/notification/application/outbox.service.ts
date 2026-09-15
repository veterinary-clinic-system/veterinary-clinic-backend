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
  
  async record(manager: EntityManager, params: RecordOutboxEventParams): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(OutboxEvent)
      .values({
        type: params.type,

        payload: params.payload as unknown as Record<string, never>,
        dedupeKey: params.dedupeKey,
      })
      
      .orIgnore()
      .execute();
  }
}
