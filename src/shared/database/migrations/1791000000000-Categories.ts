import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Danh muc hang hoa - SRS FR-14/FR-15/FR-16.
 *
 * Mot cay dung chung cho Service/Medicine/Product, phan biet bang `item_type` - xem ly
 * do trong `category.entity.ts`.
 *
 * `item_type` dung LAI kieu enum san co `items_itemtype_enum` thay vi tao mot kieu
 * `categories_item_type_enum` song song. Hai kieu enum cung noi ve mot khai niem se
 * troi khoi nhau ngay lan them gia tri thu hai (P5-T2 sap them 'PRODUCT'): phai nho
 * ALTER ca hai, quen mot cai la loi luc chay chu khong phai luc build.
 *
 * (Ten kieu la `items_itemtype_enum` - khong co gach duoi giua "item" va "type" - vi
 * `Item.itemType` khai bao `@Column` khong co `name`, nen TypeORM lay thang ten thuoc
 * tinh. Cot trong bang `items` cung vi the la `"itemType"` co ngoac kep.)
 *
 * `parent_id` dung ON DELETE RESTRICT: xoa cung mot danh muc cha dang co con la lam
 * mo coi ca nhanh. Nghiep vu chi xoa mem, va `CategoriesService` chan xoa khi con con
 * hoac con hang ben trong (FR-16 acceptance).
 */
export class Categories1791000000000 implements MigrationInterface {
  name = 'Categories1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id"            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        "deleted_at"    timestamptz,
        "category_name" varchar(255) NOT NULL,
        "code"          varchar(64)  NOT NULL,
        "parent_id"     uuid REFERENCES "categories"("id") ON DELETE RESTRICT,
        "item_type"     "items_itemtype_enum" NOT NULL,
        "active"        boolean NOT NULL DEFAULT true,
        CONSTRAINT "chk_categories_not_self_parent" CHECK ("parent_id" IS DISTINCT FROM "id")
      )
    `);

    // Partial unique: danh muc da xoa mem khong giu cho ma nua - cung quy uoc voi
    // `uq_users_customer_code` / `uq_pets_pet_code`.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_categories_code"
      ON "categories" ("code") WHERE "deleted_at" IS NULL
    `);
    // Truy van dung nhat: "moi danh muc goc cua loai X", roi "moi con cua danh muc Y".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_categories_item_type_parent"
      ON "categories" ("item_type", "parent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
  }
}
