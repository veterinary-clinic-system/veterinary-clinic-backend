import { MigrationInterface, QueryRunner } from 'typeorm';

export class LaboratoryResults1796000005000 implements MigrationInterface {
  name = 'LaboratoryResults1796000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lab_test_orders"
        ADD COLUMN IF NOT EXISTS "technician_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "lab_test_orders" ADD COLUMN IF NOT EXISTS "result_date" timestamptz
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "laboratory_results_flag_enum"
          AS ENUM ('NORMAL', 'LOW', 'HIGH', 'CRITICAL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "laboratory_results" (
        "id"                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"          timestamptz NOT NULL DEFAULT now(),
        "updated_at"          timestamptz NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz,
        "lab_test_order_id"   uuid NOT NULL REFERENCES "lab_test_orders"("id") ON DELETE CASCADE,
        "parameter"           varchar(100) NOT NULL,
        "value"               numeric(14, 4) NOT NULL,
        "unit"                varchar(50),
        "reference_min"       numeric(14, 4),
        "reference_max"       numeric(14, 4),
        "flag"                "laboratory_results_flag_enum" NOT NULL DEFAULT 'NORMAL',
        "flag_overridden"     boolean NOT NULL DEFAULT false,
        "note"                text,
        CONSTRAINT "chk_laboratory_results_reference_range"
          CHECK ("reference_min" IS NULL OR "reference_max" IS NULL
                 OR "reference_min" <= "reference_max")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_laboratory_results_order"
      ON "laboratory_results" ("lab_test_order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_laboratory_results_parameter"
      ON "laboratory_results" ("parameter")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_laboratory_results_order_parameter"
      ON "laboratory_results" ("lab_test_order_id", "parameter") WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "laboratory_results"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "laboratory_results_flag_enum"`);
    await queryRunner.query(`ALTER TABLE "lab_test_orders" DROP COLUMN IF EXISTS "result_date"`);
    await queryRunner.query(
      `ALTER TABLE "lab_test_orders" DROP COLUMN IF EXISTS "technician_user_id"`,
    );
  }
}
