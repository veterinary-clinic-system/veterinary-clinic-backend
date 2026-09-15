import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomersAndQueue1786000000000 implements MigrationInterface {
  name = 'CustomersAndQueue1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "note" text`);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_full_name_trgm"
      ON "users" USING GIN ("full_name" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_phone_trgm"
      ON "users" USING GIN ("phone" gin_trgm_ops)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "queue_entries_status_enum" AS ENUM
          ('WAITING', 'ASSIGNED', 'IN_ROOM', 'DONE', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "queue_entries_source_enum" AS ENUM ('APPOINTMENT', 'WALK_IN');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "queue_entries_priority_color_enum" AS ENUM
          ('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "queue_entries_common_symptoms_enum" AS ENUM
          ('SKIN_ALLERGY', 'EAR_INFECTION', 'VOMITING', 'DIARRHEA', 'HEMATURIA',
           'LOSS_OF_APPETITE', 'WEIGHT_LOSS', 'HYPERACTIVITY');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "queue_entries" (
        "id"                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "deleted_at"         timestamptz,
        "branch_id"          uuid        NOT NULL REFERENCES "branches"("id")     ON DELETE RESTRICT,
        "pet_id"             uuid        NOT NULL REFERENCES "pets"("id")         ON DELETE RESTRICT,
        "appointment_id"     uuid                 REFERENCES "appointments"("id") ON DELETE SET NULL,
        "doctor_id"          uuid                 REFERENCES "doctors"("id")      ON DELETE RESTRICT,
        "service_id"         uuid        NOT NULL REFERENCES "services"("id")     ON DELETE RESTRICT,
        "queue_date"         date        NOT NULL,
        "ticket_number"      integer     NOT NULL,
        "status"             "queue_entries_status_enum" NOT NULL DEFAULT 'WAITING',
        "source"             "queue_entries_source_enum" NOT NULL,
        "priority_color"     "queue_entries_priority_color_enum",
        "common_symptoms"    "queue_entries_common_symptoms_enum"[] NOT NULL DEFAULT '{}',
        "reason"             text,
        "note"               text,
        "checked_in_at"      timestamptz NOT NULL DEFAULT now(),
        "called_at"          timestamptz,
        "finished_at"        timestamptz,
        "created_by_user_id" uuid                 REFERENCES "users"("id")        ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_queue_entries_ticket_per_branch_day"
      ON "queue_entries" ("branch_id", "queue_date", "ticket_number")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_queue_entries_one_active_per_pet"
      ON "queue_entries" ("pet_id")
      WHERE "deleted_at" IS NULL AND "status" IN ('WAITING', 'ASSIGNED', 'IN_ROOM')
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_queue_entries_branch_date_status"
      ON "queue_entries" ("branch_id", "queue_date", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_queue_entries_appointment"
      ON "queue_entries" ("appointment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "queue_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "queue_entries_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "queue_entries_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "queue_entries_priority_color_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "queue_entries_common_symptoms_enum"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_phone_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_full_name_trgm"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "note"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "address"`);
  }
}
