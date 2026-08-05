import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bay truong cua don thuoc - P7-T1, SRS FR-11-01.
 *
 * BACKFILL `quantity = duration_days` LA CO CHU DICH, khong phai mot gia tri tam cho
 * co. Truoc P7, ca `BillingService` lan doan tru kho trong `examinations.service.ts`
 * deu dung `durationDays` lam so luong (co comment ASSUMPTION neu ro do la cach xoay
 * xo vi thieu du lieu). Backfill dung cong thuc cu nen so tien cua moi hoa don da lap
 * KHONG DOI khi tinh lai - va hoa don cu von da chot gia trong `invoice_items` nen cang
 * khong the doi.
 *
 * `route` mac dinh ORAL: uong la duong dung pho bien nhat, va du lieu cu khong co thong
 * tin nao de doan chinh xac hon. Ghi ro o day de sau nay khong ai nham "ORAL" trong don
 * cu la mot lua chon cua bac si.
 */
export class PrescriptionItemFields1793000000000 implements MigrationInterface {
  name = 'PrescriptionItemFields1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "prescription_items_route_enum" AS ENUM (
          'ORAL', 'INJECTION', 'TOPICAL', 'OPHTHALMIC', 'OTIC', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      ALTER TABLE "prescription_items"
        ADD COLUMN IF NOT EXISTS "quantity"  integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "frequency" varchar(255),
        ADD COLUMN IF NOT EXISTS "route"     "prescription_items_route_enum" NOT NULL DEFAULT 'ORAL'
    `);

    // Giu nguyen ket qua tinh tien cua du lieu cu - xem comment dau lop.
    //
    // `WHERE quantity = 1` la chan an toan chu khong phai dieu kien nghiep vu: cot vua
    // duoc them voi DEFAULT 1 nen moi dong cu deu dang la 1. Neu migration nay chay
    // lai tren mot CSDL da co cot (do `ADD COLUMN IF NOT EXISTS` khong bao loi), menh
    // de nay giu lai cac so luong that ma nguoi dung da nhap.
    await queryRunner.query(`
      UPDATE "prescription_items" SET "quantity" = "duration_days" WHERE "quantity" = 1
    `);

    // Cap thuoc so luong 0 hoac am la vo nghia; chan o CSDL vi con duong nhap lieu khac
    // (script, sua tay) khong di qua ValidationPipe.
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
        ADD CONSTRAINT "chk_prescription_items_quantity_positive" CHECK ("quantity" > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
        DROP CONSTRAINT IF EXISTS "chk_prescription_items_quantity_positive"
    `);
    await queryRunner.query(`
      ALTER TABLE "prescription_items"
        DROP COLUMN IF EXISTS "route",
        DROP COLUMN IF EXISTS "frequency",
        DROP COLUMN IF EXISTS "quantity"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "prescription_items_route_enum"`);
  }
}
