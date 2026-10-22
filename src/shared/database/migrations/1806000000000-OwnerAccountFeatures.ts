import { MigrationInterface, QueryRunner } from 'typeorm';

export class OwnerAccountFeatures1806000000000 implements MigrationInterface {
  name = 'OwnerAccountFeatures1806000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Quên mật khẩu: mã 6 số gửi qua Zalo/Gmail, chỉ lưu bản băm SHA-256.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_codes" (
        "id"         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "deleted_at" timestamptz,
        "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "code_hash"  varchar(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "attempts"   integer NOT NULL DEFAULT 0,
        "used_at"    timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_password_reset_codes_user"
        ON "password_reset_codes" ("user_id", "created_at")
    `);

    // Hộp thông báo của chủ nuôi (app VetCare).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "owner_notifications" (
        "id"                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"        timestamptz NOT NULL DEFAULT now(),
        "updated_at"        timestamptz NOT NULL DEFAULT now(),
        "deleted_at"        timestamptz,
        "recipient_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"              varchar(40) NOT NULL,
        "title"             varchar(200) NOT NULL,
        "body"              text NOT NULL,
        "link"              varchar(255),
        "read_at"           timestamptz,
        "dedupe_key"        varchar(200) NOT NULL UNIQUE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_owner_notif_recipient_created"
        ON "owner_notifications" ("recipient_user_id", "created_at")
    `);

    // Đổ sẵn các thông báo lịch hẹn đã gửi, mỗi thông báo một dòng dù đi qua nhiều kênh.
    // Coi như đã đọc: khách không bị dồn hàng chục tin "mới" lần đầu mở hộp thư.
    await queryRunner.query(`
      INSERT INTO "owner_notifications"
        ("created_at", "recipient_user_id", "type", "title", "body", "link", "read_at", "dedupe_key")
      SELECT DISTINCT ON (n."appointment_id", n."type", n."scheduled_for")
        COALESCE(n."sent_at", n."scheduled_for"),
        u."id",
        n."type"::text,
        CASE n."type"::text
          WHEN 'APPOINTMENT_CONFIRMED' THEN 'Xác nhận lịch hẹn khám'
          WHEN 'APPOINTMENT_REMINDER'  THEN 'Nhắc lịch hẹn khám'
          WHEN 'APPOINTMENT_UPDATED'   THEN 'Lịch hẹn của bạn có thay đổi'
          ELSE 'Lịch hẹn của bạn đã bị hủy'
        END,
        n."message",
        '/appointments/' || n."appointment_id",
        now(),
        'appt:' || n."appointment_id" || ':' || n."type"::text || ':' ||
          (EXTRACT(EPOCH FROM n."scheduled_for") * 1000)::bigint
      FROM "notifications" n
      JOIN "users" u ON u."phone" = n."recipient_phone" AND u."role" = 'PET_OWNER'
      WHERE n."status" = 'SENT' AND n."deleted_at" IS NULL
      ORDER BY n."appointment_id", n."type", n."scheduled_for", n."sent_at"
      ON CONFLICT ("dedupe_key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "owner_notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_codes"`);
  }
}
