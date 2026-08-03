import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { OutboxEvent } from '@/modules/notification/domain/entities/outbox-event.entity';

export interface RecordOutboxEventParams {
  type: string;
  payload: Record<string, unknown>;
  /**
   * Khoa chong trung. Phai duoc suy ra TAT DINH tu du kien nghiep vu, vi du
   * `appt:<id>:confirm` - khong duoc dung random/timestamp, neu khong tinh idempotent
   * mat tac dung va khach se nhan tin nhan trung.
   */
  dedupeKey: string;
}

/**
 * Ghi su kien vao bang outbox - Phan IV.2 tai lieu kien truc.
 *
 * BAT BUOC goi trong cung EntityManager cua transaction nghiep vu. Do la toan bo y
 * nghia cua mau thiet ke nay: hoac ca thay doi nghiep vu lan su kien cung duoc ghi,
 * hoac ca hai cung khong. Khong bao gio co chuyen "da xac nhan lich nhung khong gui
 * tin nhan" hay "da gui tin nhan cho mot lich hen bi rollback".
 *
 * Service nay CO CHU DICH khong tu mo transaction rieng - neu no tu mo thi su kien se
 * nam ngoai transaction nghiep vu va bao dam tren bien mat.
 */
@Injectable()
export class OutboxService {
  /**
   * @param manager EntityManager cua transaction dang chay (tu `dataSource.transaction`).
   */
  async record(manager: EntityManager, params: RecordOutboxEventParams): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(OutboxEvent)
      .values({
        type: params.type,
        // Ep kieu: QueryBuilder cua TypeORM mo ta gia tri cot bang _QueryDeepPartialEntity,
        // kieu do hieu nham mot Record<string, unknown> tuy y la "doi tuong quan he long
        // nhau" chu khong phai mot gia tri jsonb nguyen khoi.
        payload: params.payload as unknown as Record<string, never>,
        dedupeKey: params.dedupeKey,
      })
      // Su kien da ton tai thi bo qua - dam bao goi lai nhieu lan van an toan.
      .orIgnore()
      .execute();
  }
}
