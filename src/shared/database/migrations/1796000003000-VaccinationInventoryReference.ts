import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Them 'VACCINATION' vao `inventory_transactions_reference_type_enum` - P9-T2.
 *
 * Tiem la mot duong hang RA khoi kho, va so cai phai tro nguoc ve duoc mui tiem da sinh
 * ra no. Khong co gia tri nay thi lenh tru kho cua `VaccinationsService` phai ghi
 * `MANUAL`, va moi dong xuat vaccine se tron lan voi thao tac tay tren man hinh kho -
 * dung cai quyet dinh (referenceType, referenceId) sinh ra de tranh.
 *
 * File RIENG, cung ly do voi `1791000001000-AddProductItemType.ts`: gia tri enum vua
 * them khong dung duoc trong chinh transaction da them no.
 *
 * Khong co `down`: Postgres khong ho tro xoa mot gia tri khoi kieu enum.
 */
export class VaccinationInventoryReference1796000003000 implements MigrationInterface {
  name = 'VaccinationInventoryReference1796000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."inventory_transactions_reference_type_enum"
        ADD VALUE IF NOT EXISTS 'VACCINATION'
    `);
  }

  public async down(): Promise<void> {
    // Xem ghi chu o tren.
  }
}
