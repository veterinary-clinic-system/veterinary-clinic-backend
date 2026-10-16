import { MigrationInterface, QueryRunner } from 'typeorm';

export class Messaging1804000000000 implements MigrationInterface {
  name = 'Messaging1804000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Nhắn tin và gọi điện giữa chủ nuôi và bác sĩ - mỗi cặp một cuộc trò chuyện.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "messages_kind_enum" AS ENUM ('TEXT', 'IMAGE', 'CALL');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "call_sessions_media_enum" AS ENUM ('AUDIO', 'VIDEO');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "call_sessions_status_enum" AS ENUM (
          'RINGING', 'ACCEPTED', 'REJECTED', 'MISSED', 'CANCELLED', 'ENDED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id"                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"           timestamptz NOT NULL DEFAULT now(),
        "updated_at"           timestamptz NOT NULL DEFAULT now(),
        "deleted_at"           timestamptz,
        "owner_id"             uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "doctor_id"            uuid NOT NULL REFERENCES "doctors"("id") ON DELETE CASCADE,
        "last_message_at"      timestamptz,
        "last_message_preview" varchar(255),
        "owner_last_read_at"   timestamptz,
        "doctor_last_read_at"  timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_conversations_owner_doctor"
      ON "conversations" ("owner_id", "doctor_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_conversations_doctor_last_message"
      ON "conversations" ("doctor_id", "last_message_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "call_sessions" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "caller_user_id"  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "callee_user_id"  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "media"           "call_sessions_media_enum" NOT NULL,
        "status"          "call_sessions_status_enum" NOT NULL DEFAULT 'RINGING',
        "answered_at"     timestamptz,
        "ended_at"        timestamptz,
        "end_reason"      varchar(32)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_call_sessions_conversation_created"
      ON "call_sessions" ("conversation_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id"              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "sender_user_id"  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "kind"            "messages_kind_enum" NOT NULL,
        "body"            text,
        "image_url"       text,
        "call_id"         uuid REFERENCES "call_sessions"("id") ON DELETE SET NULL,
        CHECK ("body" IS NOT NULL OR "image_url" IS NOT NULL OR "call_id" IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created"
      ON "messages" ("conversation_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "call_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "call_sessions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "call_sessions_media_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "messages_kind_enum"`);
  }
}
