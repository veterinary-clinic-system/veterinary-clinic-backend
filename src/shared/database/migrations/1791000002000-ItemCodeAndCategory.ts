import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ma nghiep vu va danh muc cho `items` - SRS FR-14 (Service.Code), FR-15
 * (Medicine.Code), FR-16 (Product.Category), NFR-02 (tim kiem nhanh).
 *
 * DAT O `items`, KHONG NHAN BAN XUONG BANG CON. FR-14 doi `Service.Code` va FR-15 doi
 * `Medicine.Code`; hai cot ma o hai bang con nghia la o tim kiem "nhap ma hang" phai
 * UNION hai bang va khong the co mot chi muc duy nhat phuc vu no. Mot cot tren `items`
 * la du cho ca ba loai.
 *
 * MOT SEQUENCE CHO MOI TIEN TO, khong dung chung mot bo dem: dung chung thi dich vu
 * thu hai trong he thong co the mang ma DV0007 chi vi da co 6 loai thuoc duoc tao
 * truoc - doc len nghe nhu he thong mat du lieu. Tien to:
 *   SERVICE -> DV   MEDICATION -> TH   LAB_TEST -> XN   PRODUCT -> SP   OTHER -> HH
 *
 * Cap ma bang TRIGGER chu khong phai cot DEFAULT: tien to phu thuoc `itemType` cua
 * chinh dong dang chen, ma mot bieu thuc DEFAULT khong nhin thay duoc cac cot khac.
 * (Khac `pets.pet_code` - o do moi dong deu cung mot tien to nen DEFAULT la du.)
 *
 * Backfill chay TRUOC khi gan trigger va co ORDER BY `created_at`: neu de trigger tu
 * cap khi duyet, Postgres di theo thu tu vat ly cua bang va item cu co the nhan ma lon
 * hon item moi.
 */
export class ItemCodeAndCategory1791000002000 implements MigrationInterface {
  name = 'ItemCodeAndCategory1791000002000';

  private static readonly PREFIXES: Array<[itemType: string, prefix: string]> = [
    ['SERVICE', 'DV'],
    ['MEDICATION', 'TH'],
    ['LAB_TEST', 'XN'],
    ['PRODUCT', 'SP'],
    ['OTHER', 'HH'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "code" varchar(32)`);
    await queryRunner.query(`
      ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "category_id" uuid
        REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    for (const [itemType, prefix] of ItemCodeAndCategory1791000002000.PREFIXES) {
      const sequence = `item_code_${prefix.toLowerCase()}_seq`;
      await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "${sequence}" START 1`);

      // So sanh qua ::text thay vi literal enum - khong phu thuoc vao viec gia tri
      // 'PRODUCT' da duoc ALTER TYPE o migration truoc hay chua.
      await queryRunner.query(`
        UPDATE "items" i
           SET "code" = '${prefix}' || LPAD(s."seq"::text, 4, '0')
          FROM (
            SELECT "id", nextval('${sequence}') AS "seq"
              FROM (
                SELECT "id" FROM "items"
                 WHERE "itemType"::text = '${itemType}' AND "code" IS NULL
                 ORDER BY "created_at", "id"
              ) ordered
          ) s
         WHERE i."id" = s."id"
      `);
    }

    const cases = ItemCodeAndCategory1791000002000.PREFIXES.map(
      ([itemType, prefix]) =>
        `WHEN '${itemType}' THEN '${prefix}' || LPAD(nextval('item_code_${prefix.toLowerCase()}_seq')::text, 4, '0')`,
    ).join('\n            ');

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "assign_item_code"() RETURNS trigger AS $$
      BEGIN
        IF NEW."code" IS NULL THEN
          NEW."code" := CASE NEW."itemType"::text
            ${cases}
          END;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assign_item_code" ON "items"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_assign_item_code"
      BEFORE INSERT ON "items"
      FOR EACH ROW EXECUTE FUNCTION "assign_item_code"()
    `);

    await queryRunner.query(`ALTER TABLE "items" ALTER COLUMN "code" SET NOT NULL`);

    // Partial unique - item xoa mem khong giu cho ma (cung quy uoc voi uq_pets_pet_code).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_items_code"
      ON "items" ("code") WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_items_category" ON "items" ("category_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_assign_item_code" ON "items"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "assign_item_code"()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_items_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_items_code"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN IF EXISTS "code"`);
    for (const [, prefix] of ItemCodeAndCategory1791000002000.PREFIXES) {
      await queryRunner.query(`DROP SEQUENCE IF EXISTS "item_code_${prefix.toLowerCase()}_seq"`);
    }
  }
}
