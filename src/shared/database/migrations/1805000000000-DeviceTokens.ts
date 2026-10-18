import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceTokens1805000000000 implements MigrationInterface {
  name = 'DeviceTokens1805000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Kênh push của app chủ nuôi (P12-T7).
    await queryRunner.query(`
      ALTER TYPE "notifications_channel_enum" ADD VALUE IF NOT EXISTS 'PUSH'
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "device_tokens_platform_enum" AS ENUM ('ANDROID', 'IOS');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    // Một token thuộc đúng một máy: đăng nhập tài khoản khác trên cùng máy thì token
    // chuyển chủ (upsert theo token), không để hai tài khoản cùng nhận push của nhau.
    // `phone` chép từ users để kênh PUSH tìm máy theo recipient_phone như Zalo/SMS.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device_tokens" (
        "id"           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "updated_at"   timestamptz NOT NULL DEFAULT now(),
        "deleted_at"   timestamptz,
        "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "phone"        varchar(20) NOT NULL,
        "token"        varchar(255) NOT NULL UNIQUE,
        "platform"     "device_tokens_platform_enum" NOT NULL,
        "last_seen_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_device_tokens_user" ON "device_tokens" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_device_tokens_phone" ON "device_tokens" ("phone")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "device_tokens"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "device_tokens_platform_enum"`);
    // Postgres không xoá được một giá trị enum: 'PUSH' ở notifications_channel_enum được giữ lại.
  }
}
