import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Them gia tri 'PRODUCT' vao `items_itemtype_enum` - SRS FR-16 (P5-T3 can no).
 *
 * Migration nay CHI lam mot viec va phai dung rieng mot file, cung ly do voi
 * `1787000000000-AddStaffRoles.ts`: Postgres cho phep `ALTER TYPE ... ADD VALUE` ben
 * trong transaction (tu 12), NHUNG gia tri vua them KHONG dung duoc trong chinh
 * transaction do. Gop chung voi migration sau (co `WHERE "itemType" = 'PRODUCT'`) se
 * that bai voi loi "unsafe use of new value of enum type".
 *
 * Khong co `down`: Postgres khong ho tro xoa mot gia tri khoi kieu enum.
 */
export class AddProductItemType1791000001000 implements MigrationInterface {
  name = 'AddProductItemType1791000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."items_itemtype_enum" ADD VALUE IF NOT EXISTS 'PRODUCT'`,
    );
  }

  public async down(): Promise<void> {
    // Xem ghi chu o tren - khong the go mot gia tri khoi kieu enum cua Postgres.
  }
}
