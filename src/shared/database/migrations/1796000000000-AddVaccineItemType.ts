import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Them gia tri 'VACCINE' vao `items_itemtype_enum` - SRS FR-12 (P9-T1 can no).
 *
 * Dung RIENG mot file, cung ly do voi `1791000001000-AddProductItemType.ts`: Postgres
 * cho `ALTER TYPE ... ADD VALUE` trong transaction nhung khong cho DUNG gia tri vua
 * them trong chinh transaction do.
 *
 * Khong co `down`: Postgres khong ho tro xoa mot gia tri khoi kieu enum.
 */
export class AddVaccineItemType1796000000000 implements MigrationInterface {
  name = 'AddVaccineItemType1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."items_itemtype_enum" ADD VALUE IF NOT EXISTS 'VACCINE'`,
    );
  }

  public async down(): Promise<void> {
    // Xem ghi chu o tren - khong the go mot gia tri khoi kieu enum cua Postgres.
  }
}
