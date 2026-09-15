import { MigrationInterface, QueryRunner } from 'typeorm';

export class StaffNotifications1797000000000 implements MigrationInterface {
  name = 'StaffNotifications1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    
    await queryRunner.query(`
      ALTER TYPE "notifications_channel_enum" ADD VALUE IF NOT EXISTS 'EMAIL'
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "staff_notifications_type_enum" AS ENUM (
          'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRING_SOON', 'EXPIRED',
          'PAYMENT_FAILED', 'APPOINTMENT_CANCELLED', 'VACCINATION_DUE'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "staff_notifications" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "recipient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"              "staff_notifications_type_enum" NOT NULL,
        "title"             varchar(200) NOT NULL,
        "body"              text NOT NULL,
        "link"              varchar(255),
        "branch_id"         uuid REFERENCES "branches"("id") ON DELETE SET NULL,
        "read_at"           timestamptz,
        "dedupe_key"        varchar(200) NOT NULL UNIQUE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_staff_notif_recipient_unread"
      ON "staff_notifications" ("recipient_user_id", "read_at", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_staff_notif_recipient_unread"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "staff_notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "staff_notifications_type_enum"`);

  }
}
