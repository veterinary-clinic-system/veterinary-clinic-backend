import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ho so khach hang + hang cho tai quay le tan.
 *
 * 1. `users.address` / `users.note` - ho so khach hang can dia chi thuong tru va mot o
 *    ghi chu tu do cho le tan. `appointments.address` san co chi la dia chi cua RIENG
 *    mot lan hen (vi du dia chi den don thu cung), khong thay the duoc.
 *
 * 2. Bang `queue_entries` - hang cho trong ngay. Xem queue-entry.entity.ts de biet vi
 *    sao khong tai su dung thang bang `appointments` lam hang cho.
 *
 * Migration nay chi THEM, khong doi kieu cot nao dang co - chay duoc tren du lieu that
 * ma khong can seed lai.
 */
export class CustomersAndQueue1786000000000 implements MigrationInterface {
  name = 'CustomersAndQueue1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ================================================================
    // 1. HO SO KHACH HANG
    // ================================================================
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "address" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "note" text`);

    // Le tan tra cuu khach bang cach go mot phan ho ten hoac so dien thoai. Chi muc
    // trigram lam ILIKE '%...%' dung duoc chi muc - khong co no thi moi lan go phim la
    // mot lan quet toan bang `users`. pg_trgm da duoc bat o migration truoc.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_full_name_trgm"
      ON "users" USING GIN ("full_name" gin_trgm_ops)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_phone_trgm"
      ON "users" USING GIN ("phone" gin_trgm_ops)
    `);

    // ================================================================
    // 2. HANG CHO
    // ================================================================
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
    // Kieu enum RIENG cho bang nay chu khong dung lai
    // "appointments_priority_color_enum" / "appointments_commonsymptoms_enum": ten kieu
    // phai khop dung quy uoc TypeORM sinh ra tu (ten bang, ten cot), neu khong thi lan
    // `migration:generate` sau se tuong schema bi lech va sinh ra migration thua.
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

    // So thu tu duy nhat theo (chi nhanh, ngay). Partial index bo qua ban ghi da xoa
    // mem - cung quy uoc voi cac chi muc duy nhat khac trong he thong (Phan V.4 #5).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_queue_entries_ticket_per_branch_day"
      ON "queue_entries" ("branch_id", "queue_date", "ticket_number")
      WHERE "deleted_at" IS NULL
    `);

    // Mot thu cung chi duoc co DUNG MOT luot cho con hoat dong tai mot thoi diem.
    // Khong co rang buoc nay thi bam nham nut "check-in" hai lan se tao hai so thu tu
    // cho cung mot con - loi ma kiem tra o tang ung dung khong dong kin duoc khi hai
    // request chay song song.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_queue_entries_one_active_per_pet"
      ON "queue_entries" ("pet_id")
      WHERE "deleted_at" IS NULL AND "status" IN ('WAITING', 'ASSIGNED', 'IN_ROOM')
    `);

    // Truy van chinh cua man hinh quay le tan: hang cho cua chi nhanh X trong ngay Y.
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
