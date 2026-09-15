import { MigrationInterface, QueryRunner } from 'typeorm';

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

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_categories_code"
      ON "categories" ("code") WHERE "deleted_at" IS NULL
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_categories_item_type_parent"
      ON "categories" ("item_type", "parent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
  }
}
