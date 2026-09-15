import { MigrationInterface, QueryRunner } from 'typeorm';

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

    await queryRunner.query(`
      UPDATE "prescription_items" SET "quantity" = "duration_days" WHERE "quantity" = 1
    `);

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
