import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ap dung Phan V (Co so du lieu) cua tai lieu kien truc VetCare AI.
 *
 * Migration nay co pha vo schema (doi kieu cot tien te, them cot moi). Voi du lieu
 * dev thi seed lai la xong; voi du lieu that phai sao luu truoc.
 *
 * Ghi chu ve pgvector (Phan V.1.4): KHONG bat `CREATE EXTENSION vector` o day, vi
 * anh postgres:16-alpine tieu chuan khong kem san pgvector va migration se that bai.
 * Do la "huong phat trien" trong tai lieu, khong phai yeu cau cua ban hien tai -
 * khi nao can thi doi sang anh pgvector/pgvector va them mot migration rieng.
 */
export class ArchitectureDocPartV1785000000000 implements MigrationInterface {
  name = 'ArchitectureDocPartV1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ================================================================
    // 1. CAC EXTENSION CAN THIET (Phan V.1)
    // ================================================================
    // btree_gist: cho phep tron cot binh thuong (=) voi cot pham vi (&&) trong mot
    //             rang buoc EXCLUDE - can cho chong trung lich hen.
    // unaccent  : bo dau tieng Viet ("Cho Muc" khop "cho muc").
    // pg_trgm   : tim gan dung, chiu duoc go sai chinh ta.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // `unaccent()` chi la STABLE (no phu thuoc tu dien co the thay doi), trong khi
    // cot sinh (generated column) va chi muc bieu thuc doi ham IMMUTABLE. Boc lai
    // qua ham nay - chi dinh ro tu dien nen ket qua tro thanh tat dinh.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION f_unaccent(text)
      RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
      $$ SELECT public.unaccent('public.unaccent', $1) $$
    `);

    // ================================================================
    // 2. XOA MEM (Phan V.4 quyet dinh #5, rang buoc R6)
    // ================================================================
    // Them deleted_at vao moi bang nghiep vu ke thua BaseEntity.
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

    // Chi muc duy nhat phai tro thanh partial: sau khi xoa mem mot nguoi dung, so dien
    // thoai do phai dung lai duoc cho ban ghi moi.
    // Ten rang buoc trong migration goc do TypeORM sinh tu dong (UQ_<hash>), khong doan
    // duoc - tra cuu tu catalog he thong roi drop theo ten thuc te.
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

    // ================================================================
    // 3. TIEN TE -> BIGINT DON VI DONG (Phan V.4 quyet dinh #2)
    // ================================================================
    // VND khong co don vi nho hon dong. Giu numeric(12,2) nghia la luon keo theo
    // hai chu so thap phan vo nghia, con float thi gay sai so cong don - khong chap
    // nhan duoc voi chung tu tai chinh.
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

    // ================================================================
    // 4. CHONG TRUNG LICH HEN O TANG CSDL (Phan V.1.1)
    // ================================================================
    // Day la ly do manh nhat de chon PostgreSQL thay vi MySQL. Kiem tra o tang ung
    // dung luon co khe ho race condition: hai request dat cung khung gio cua cung bac
    // si chay song song deu vuot qua buoc "kiem tra con trong khong" truoc khi ben kia
    // kip INSERT. Rang buoc EXCLUDE dong khe ho do lai o dung mot cho.
    //
    // Cac trang thai CANCELLED / NO_SHOW khong con giu cho nen duoc loai tru - khop
    // voi SLOT_BLOCKING_STATUSES trong shared/common/enums/appointment-status.enum.ts.
    //
    // Neu du lieu hien co da co lich trung, lenh nay se that bai - do la co y: phai
    // don du lieu truoc chu khong duoc am tham bo qua.
    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD CONSTRAINT "appointment_no_overlap"
      EXCLUDE USING gist (
        "doctor_id" WITH =,
        tstzrange("start_at", "end_at", '[)') WITH &&
      )
      WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW') AND "deleted_at" IS NULL)
    `);

    // ================================================================
    // 5. OUTPUT AI: JSONB + GIN (Phan V.1.2)
    // ================================================================
    // Hinh dang output cua model SE doi moi lan retrain / doi kien truc. Neu chuan hoa
    // thanh bang thi moi lan do lai phai migrate schema. JSONB co GIN cho ta do linh
    // hoat cua document database dung tai cho can, phan nghiep vu con lai van quan he chat.
    await queryRunner.query(`
      ALTER TABLE "pre_screening_results"
      ADD COLUMN IF NOT EXISTS "model_version" VARCHAR(64) NOT NULL DEFAULT 'unknown'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescreening_raw_ai_gin"
      ON "pre_screening_results" USING GIN ("raw_ai_response" jsonb_path_ops)
    `);
    // Phuc vu bao cao do chinh xac AI theo tung phien ban model.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescreening_model_version"
      ON "pre_screening_results" ("model_version", "created_at")
    `);

    // ================================================================
    // 6. TIM KIEM TIENG VIET (Phan V.1.3)
    // ================================================================
    // Yeu cau: le tan go "cho muc" phai ra "Cho Muc"; go sai chinh ta van ra ket qua.
    // Co san hai thu nay thi khong can Elasticsearch - bot mot thanh phan phai van hanh.
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
    // Le tan tra cuu theo so dien thoai go tung phan.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_phone_trgm"
      ON "users" USING GIN ("phone" gin_trgm_ops)
    `);

    // ================================================================
    // 7. TRANSACTIONAL OUTBOX (Phan IV.2)
    // ================================================================
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
    // Partial index: chi chua cac su kien CHUA xu ly. Bang co the phinh to theo thoi
    // gian ma chi muc worker dung van luon nho.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_outbox_unprocessed"
      ON "outbox_events" ("created_at") WHERE "processed_at" IS NULL
    `);

    // ================================================================
    // 8. AUDIT LOG PHAN MANH THEO THANG (Phan V.4 quyet dinh #8, R6)
    // ================================================================
    // Bang tang nhanh nhat he thong. Phan manh cho phep don du lieu cu bang
    // DROP PARTITION (tuc thi) thay vi DELETE (cham, de lai bloat phai VACUUM).
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

    // Ham tao partition cho mot thang bat ky, goi duoc nhieu lan ma khong loi.
    // Worker se goi ham nay hang thang de tao truoc partition cua thang sau.
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

    // Tao san partition cho thang truoc, thang nay va thang sau, de he thong ghi duoc
    // ngay ma khong cho worker chay lan dau.
    await queryRunner.query(
      `SELECT ensure_audit_log_partition((now() - interval '1 month')::date)`,
    );
    await queryRunner.query(`SELECT ensure_audit_log_partition(now()::date)`);
    await queryRunner.query(
      `SELECT ensure_audit_log_partition((now() + interval '1 month')::date)`,
    );

    // Partition mac dinh: hung cac dong roi ngoai moi khoang da tao, de mot su co
    // "quen tao partition" khong lam mat ban ghi kiem toan.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs_default"
      PARTITION OF "audit_logs" DEFAULT
    `);

    // ================================================================
    // 9. CHI MUC THEO TRUY VAN THUC TE (Phan V.5)
    // ================================================================
    // Nguyen tac cua tai lieu: khong tao chi muc suy doan. Bon chi muc duoi day tuong
    // ung dung bon truy van duoc liet ke o bang V.5.

    // "Hang doi hom nay cua chi nhanh" - partial index nen rat nho, chi chua cac ca
    // dang cho kham chu khong phai toan bo lich su.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_queue_today"
      ON "appointments" ("branch_id", "start_at")
      WHERE "status" IN ('CHECKED_IN', 'IN_PROGRESS') AND "deleted_at" IS NULL
    `);

    // "Timeline thu cung" - lich su kham cua mot be, moi nhat truoc.
    // Dat tren "appointments" chu KHONG phai "examinations": bang examinations khong co
    // cot pet_id, no lien he voi thu cung gian tiep qua appointment. Truy van timeline
    // vi vay bat dau tu appointments roi join sang examinations.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_pet_timeline"
      ON "appointments" ("pet_id", "start_at" DESC)
      WHERE "deleted_at" IS NULL
    `);

    // "Bao cao doanh thu theo khoang ngay" - covering index cho phep index-only scan,
    // khong phai cham vao bang chinh.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_invoices_revenue"
      ON "invoices" ("paid_at") INCLUDE ("paid", "payment_method")
      WHERE "paid" = true AND "deleted_at" IS NULL
    `);

    // Tra cuu lich hen cua mot bac si trong khoang thoi gian (man hinh lich lam viec).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_appointments_doctor_range"
      ON "appointments" ("doctor_id", "start_at", "end_at")
      WHERE "deleted_at" IS NULL
    `);

    // ================================================================
    // 10. CQRS-LITE: MATERIALIZED VIEW CHO BAO CAO (Phan IV.3)
    // ================================================================
    // Truy van bao cao la tong hop nang, quet nhieu bang. Chay chung duong voi OLTP
    // se lam cham man hinh kham. Tach ra materialized view, worker lam moi theo lich.

    // Doanh thu theo ngay va chi nhanh.
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
    // UNIQUE index la DIEU KIEN BAT BUOC de dung REFRESH ... CONCURRENTLY (lam moi ma
    // khong khoa nguoi doc). Thieu no thi moi lan refresh se chan man hinh bao cao.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_mv_revenue_daily"
      ON "mv_revenue_daily" ("day", "branch_id")
    `);

    // Do chinh xac cua AI theo ngay va phien ban model: bao nhieu lan nhan vien giu
    // nguyen mau uu tien AI de xuat, bao nhieu lan ho sua.
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
