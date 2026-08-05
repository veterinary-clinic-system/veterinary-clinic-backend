import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS, Permission } from '@/shared/common/enums/permission.enum';

/**
 * Ba quyen moi cua don thuoc - P7-T5, SRS FR-11.
 *
 * TAO LAI KIEU ENUM thay vi `ALTER TYPE ... ADD VALUE`. Ly do ky thuat: Postgres khong
 * cho DUNG mot gia tri enum vua duoc them trong cung transaction, ma TypeORM chay ca
 * loat migration trong mot transaction - nen `ADD VALUE` roi `INSERT` gia tri do ngay
 * ben duoi se bao "unsafe use of new value". Doi ten kieu cu, dung kieu moi tu
 * `Object.values(Permission)` roi ep cot sang kieu moi thi lam duoc tat ca trong mot
 * transaction, va danh sach luon khop voi ma nguon.
 *
 * `ON CONFLICT DO NOTHING` khi seed: cung quy uoc voi `RolePermissions1787000001000` -
 * migration khong duoc ghi de len ma tran ma quan tri vien da sua qua giao dien.
 *
 * Chi seed ba quyen MOI chu khong seed lai toan bo ma tran: neu quan tri vien da go bo
 * mot quyen cu cua mot vai tro, chay migration nay khong duoc phep tra no ve.
 */
export class PrescriptionPermissions1793000002000 implements MigrationInterface {
  name = 'PrescriptionPermissions1793000002000';

  private static readonly NEW_PERMISSIONS = [
    Permission.PRESCRIPTION_VIEW,
    Permission.PRESCRIPTION_CREATE,
    Permission.PRESCRIPTION_DISPENSE,
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const permissionValues = Object.values(Permission)
      .map((p) => `'${p}'`)
      .join(', ');

    await queryRunner.query(`
      ALTER TYPE "role_permissions_permission_enum"
        RENAME TO "role_permissions_permission_enum_old"
    `);
    await queryRunner.query(`
      CREATE TYPE "role_permissions_permission_enum" AS ENUM (${permissionValues})
    `);
    await queryRunner.query(`
      ALTER TABLE "role_permissions"
        ALTER COLUMN "permission" TYPE "role_permissions_permission_enum"
        USING "permission"::text::"role_permissions_permission_enum"
    `);
    await queryRunner.query(`DROP TYPE "role_permissions_permission_enum_old"`);

    const newOnes = new Set<string>(PrescriptionPermissions1793000002000.NEW_PERMISSIONS);
    const rows: string[] = [];
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        if (newOnes.has(permission)) {
          rows.push(`('${role}', '${permission}')`);
        }
      }
    }

    if (rows.length > 0) {
      await queryRunner.query(`
        INSERT INTO "role_permissions" ("role", "permission")
        VALUES ${rows.join(', ')}
        ON CONFLICT ("role", "permission") DO NOTHING
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const removed = PrescriptionPermissions1793000002000.NEW_PERMISSIONS.map((p) => `'${p}'`).join(
      ', ',
    );
    await queryRunner.query(`
      DELETE FROM "role_permissions" WHERE "permission"::text IN (${removed})
    `);

    const remaining = Object.values(Permission)
      .filter((p) => !PrescriptionPermissions1793000002000.NEW_PERMISSIONS.includes(p))
      .map((p) => `'${p}'`)
      .join(', ');
    await queryRunner.query(`
      ALTER TYPE "role_permissions_permission_enum"
        RENAME TO "role_permissions_permission_enum_old"
    `);
    await queryRunner.query(`
      CREATE TYPE "role_permissions_permission_enum" AS ENUM (${remaining})
    `);
    await queryRunner.query(`
      ALTER TABLE "role_permissions"
        ALTER COLUMN "permission" TYPE "role_permissions_permission_enum"
        USING "permission"::text::"role_permissions_permission_enum"
    `);
    await queryRunner.query(`DROP TYPE "role_permissions_permission_enum_old"`);
  }
}
