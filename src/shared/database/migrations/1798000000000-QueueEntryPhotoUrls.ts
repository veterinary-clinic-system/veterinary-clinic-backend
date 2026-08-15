import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Anh trieu chung tren luot cho - phan hoi nghiem thu: "Cach dien trieu chung giong voi
 * khi dien form gui" (bieu mau dat lich cong khai co dinh kem anh).
 *
 * Phai la mot cot RIENG tren `queue_entries` chu khong the muon cot cua
 * `appointments`: luot cho cua khach vang lai chua duoc gan bac si thi CHUA co lich hen
 * nao ca (xem ghi chu dau `QueueEntry`), nen anh se khong co cho de nam. Khi luot cho
 * duoc gan bac si, `QueueService.assignDoctor` chep sang lich hen vua tao.
 *
 * `DEFAULT '{}'` de moi dong cu thanh mang rong thay vi NULL - phia ung dung khong phai
 * phan biet "chua co anh" voi "khong co anh".
 */
export class QueueEntryPhotoUrls1798000000000 implements MigrationInterface {
  name = 'QueueEntryPhotoUrls1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "queue_entries"
        ADD COLUMN IF NOT EXISTS "photo_urls" text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_entries" DROP COLUMN IF EXISTS "photo_urls"`);
  }
}
