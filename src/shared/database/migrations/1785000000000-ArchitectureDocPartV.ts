import { MigrationInterface, QueryRunner } from 'typeorm';

export class ArchitectureDocPartV1785000000000 implements MigrationInterface {
  name = 'ArchitectureDocPartV1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION f_unaccent(text)
      RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
      $$ SELECT public.unaccent('public.unaccent', $1) $$
    `);

    const softDeletableTables = [
      'users',
      'refresh_tokens',
      'doctors',
      'branches',
      'operating_hours',
      'species',
      'breeds',
      'pets',
      'items',
      'services',
      'medications',
      'inventory_items',
      'diseases',
      'doctor_shifts',
      'doctor_breaks',
      'appointments',
      'pre_screening_results',
      'examinations',
      'prescriptions',
      'prescription_items',
      'lab_test_orders',
      'invoices',
      'invoice_items',
      'notifications',
    ];
    for (const table of softDeletableTables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ`,
      );
    }

    await queryRunner.query(`
      DO $$
      DECLARE c RECORD;
      BEGIN
        FOR c IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN unnest(con.conkey) AS k(attnum) ON true
          JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
          WHERE rel.relname = 'users'
            AND con.contype = 'u'
            AND att.attname IN ('phone', 'email')
        LOOP
          EXECUTE format('ALTER TABLE "users" DROP CONSTRAINT %I', c.conname);
        END LOOP;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_phone_alive"
      ON "users" ("phone") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_users_email_alive"
      ON "users" ("email") WHERE "email" IS NOT NULL AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "items"
      ALTER COLUMN "unit_price" TYPE BIGINT USING round("unit_price")::bigint,
      ALTER COLUMN "unit_price" SET DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ALTER COLUMN "price" TYPE BIGINT USING round("price")::bigint
    `);
    await queryRunner.query(`
      ALTER TABLE "items" ADD CONSTRAINT "chk_items_unit_price_non_negative"
      CHECK ("unit_price" >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_items" ADD CONSTRAINT "chk_invoice_items_price_non_negative"
      CHECK ("price" >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "appointment_no_overlap"
      EXCLUDE USING gist (
        "doctor_id" WITH =,
        tstzrange("start_at", "end_at", '[)') WITH &&
      )
      WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW') AND "deleted_at" IS NULL)
    `);

    await queryRunner.query(`
      ALTER TABLE "pre_screening_results"
      ADD COLUMN IF NOT EXISTS "model_version" VARCHAR(64) NOT NULL DEFAULT 'unknown'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescreening_raw_ai_gin"
      ON "pre_screening_results" USING GIN ("raw_ai_response" jsonb_path_ops)
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescreening_model_version"
      ON "pre_screening_results" ("model_version", "created_at")
    `);

    await queryRunner.query(`
      ALTER TABLE "pets"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (to_tsvector('simple', f_unaccent(coalesce("name", '')))) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pets_search"
      ON "pets" USING GIN ("search_vector")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pets_name_trgm"
      ON "pets" USING GIN (f_unaccent("name") gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_full_name_trgm"
      ON "users" USING GIN (f_unaccent("full_name") gin_trgm_ops)
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_phone_trgm"
      ON "users" USING GIN ("phone" gin_trgm_ops)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type"         VARCHAR(64)  NOT NULL,
        "payload"      JSONB        NOT NULL,
        "dedupe_key"   VARCHAR(255) NOT NULL UNIQUE,
        "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMPTZ,
        "attempts"     INTEGER      NOT NULL DEFAULT 0,
        "last_error"   TEXT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_unprocessed"
      ON "outbox_events" ("created_at") WHERE "processed_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
        "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
        "actor_user_id" UUID,
        "action"        VARCHAR(64) NOT NULL,
        "entity_name"   VARCHAR(64) NOT NULL,
        "entity_id"     UUID,
        "changes"       JSONB,
        "ip_address"    INET,
        "user_agent"    TEXT,
        PRIMARY KEY ("id", "created_at")
      ) PARTITION BY RANGE ("created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_actor_time"
      ON "audit_logs" ("actor_user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_audit_entity"
      ON "audit_logs" ("entity_name", "entity_id")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION ensure_audit_log_partition(target_month DATE)
      RETURNS void
      LANGUAGE plpgsql AS $$
      DECLARE
        start_date DATE := date_trunc('month', target_month)::date;
        end_date   DATE := (date_trunc('month', target_month) + interval '1 month')::date;
        part_name  TEXT := 'audit_logs_' || to_char(start_date, 'YYYY_MM');
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
          EXECUTE format(
            'CREATE TABLE %I PARTITION OF "audit_logs" FOR VALUES FROM (%L) TO (%L)',
            part_name, start_date, end_date
          );
        END IF;
      END $$
    `);

    await queryRunner.query(
      `SELECT ensure_audit_log_partition((now() - interval '1 month')::date)`,
    );
    await queryRunner.query(`SELECT ensure_audit_log_partition(now()::date)`);
    await queryRunner.query(
      `SELECT ensure_audit_log_partition((now() + interval '1 month')::date)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs_default"
      PARTITION OF "audit_logs" DEFAULT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_queue_today"
      ON "appointments" ("branch_id", "start_at")
      WHERE "status" IN ('CHECKED_IN', 'IN_PROGRESS') AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_pet_timeline"
      ON "appointments" ("pet_id", "start_at" DESC)
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_revenue"
      ON "invoices" ("paid_at") INCLUDE ("paid", "payment_method")
      WHERE "paid" = true AND "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_doctor_range"
      ON "appointments" ("doctor_id", "start_at", "end_at")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_revenue_daily" AS
      SELECT
        date_trunc('day', i."paid_at")            AS day,
        a."branch_id"                             AS branch_id,
        count(DISTINCT i."id")                    AS invoice_count,
        coalesce(sum(ii."price" * ii."quantity"), 0) AS total_revenue
      FROM "invoices" i
      JOIN "appointments" a  ON a."id" = i."appointment_id"
      LEFT JOIN "invoice_items" ii ON ii."invoice_id" = i."id" AND ii."deleted_at" IS NULL
      WHERE i."paid" = true AND i."paid_at" IS NOT NULL AND i."deleted_at" IS NULL
      GROUP BY 1, 2
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_mv_revenue_daily"
      ON "mv_revenue_daily" ("day", "branch_id")
    `);

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS "mv_ai_accuracy_daily" AS
      SELECT
        date_trunc('day', p."created_at")  AS day,
        p."model_version"                  AS model_version,
        count(*)                           AS total,
        -- Phai ep ca hai ve text: TypeORM tao MOT kieu enum RIENG cho moi cot
        -- ("appointments_priority_color_enum" va
        -- "pre_screening_results_ai_priority_color_enum"), va PostgreSQL khong co
        -- toan tu "=" giua hai kieu enum khac nhau du danh sach gia tri giong het.
        count(*) FILTER (
          WHERE a."priority_color"::text = p."ai_priority_color"::text
        ) AS accepted,
        count(*) FILTER (
          WHERE a."priority_color"::text IS DISTINCT FROM p."ai_priority_color"::text
        ) AS overridden,
        avg(p."overall_confidence")        AS avg_confidence
      FROM "pre_screening_results" p
      JOIN "appointments" a ON a."id" = p."appointment_id"
      WHERE p."deleted_at" IS NULL
      GROUP BY 1, 2
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_mv_ai_accuracy_daily"
      ON "mv_ai_accuracy_daily" ("day", "model_version")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_ai_accuracy_daily"`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_revenue_daily"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_appointments_doctor_range"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_invoices_revenue"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_appointments_pet_timeline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_appointments_queue_today"`);

    await queryRunner.query(`DROP FUNCTION IF EXISTS ensure_audit_log_partition(DATE)`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_phone_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_full_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pets_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pets_search"`);
    await queryRunner.query(`ALTER TABLE "pets" DROP COLUMN IF EXISTS "search_vector"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescreening_model_version"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescreening_raw_ai_gin"`);
    await queryRunner.query(
      `ALTER TABLE "pre_screening_results" DROP COLUMN IF EXISTS "model_version"`,
    );

    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointment_no_overlap"`,
    );

    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "chk_invoice_items_price_non_negative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT IF EXISTS "chk_items_unit_price_non_negative"`,
    );
    await queryRunner.query(`ALTER TABLE "invoice_items" ALTER COLUMN "price" TYPE NUMERIC(12,2)`);
    await queryRunner.query(`ALTER TABLE "items" ALTER COLUMN "unit_price" TYPE NUMERIC(12,2)`);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_email_alive"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_phone_alive"`);

    const softDeletableTables = [
      'users',
      'refresh_tokens',
      'doctors',
      'branches',
      'operating_hours',
      'species',
      'breeds',
      'pets',
      'items',
      'services',
      'medications',
      'inventory_items',
      'diseases',
      'doctor_shifts',
      'doctor_breaks',
      'appointments',
      'pre_screening_results',
      'examinations',
      'prescriptions',
      'prescription_items',
      'lab_test_orders',
      'invoices',
      'invoice_items',
      'notifications',
    ];
    for (const table of softDeletableTables) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at"`);
    }

    await queryRunner.query(`DROP FUNCTION IF EXISTS f_unaccent(text)`);
  }
}
