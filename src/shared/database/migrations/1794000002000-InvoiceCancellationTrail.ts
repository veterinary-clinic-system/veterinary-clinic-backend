import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Luu vet huy hoa don - P8-T3, BR-14.
 *
 * Cung khuon voi `1789000000000-AppointmentCancellationTrail`: khong xoa chung tu khi
 * huy, ma ghi lai LY DO va THOI DIEM. Ke toan doi soat cuoi ky se hoi "hoa don nay dau"
 * truoc bat cu cau hoi nao khac, va mot dong da bien mat khong tra loi duoc.
 */
export class InvoiceCancellationTrail1794000002000 implements MigrationInterface {
  name = 'InvoiceCancellationTrail1794000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        ADD COLUMN IF NOT EXISTS "cancel_reason" text,
        ADD COLUMN IF NOT EXISTS "cancelled_at"  timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoices"
        DROP COLUMN IF EXISTS "cancelled_at",
        DROP COLUMN IF EXISTS "cancel_reason"
    `);
  }
}
