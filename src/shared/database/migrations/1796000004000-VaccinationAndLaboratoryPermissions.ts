import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS, Permission } from '@/shared/common/enums/permission.enum';

/**
 * Bon quyen moi cua P9 - SRS FR-12, FR-13.
 *
 * TAO LAI KIEU ENUM thay vi `ALTER TYPE ... ADD VALUE`, va chi seed CAC QUYEN MOI chu
 * khong seed lai ca ma tran: ca hai quyet dinh va ly do cua chung da ghi day du o
 * `1793000002000-PrescriptionPermissions.ts` - migration nay lam y het.
 */
export class VaccinationAndLaboratoryPermissions1796000004000 implements MigrationInterface {
  name = 'VaccinationAndLaboratoryPermissions1796000004000';

  private static readonly NEW_PERMISSIONS = [
    Permission.VACCINATION_VIEW,
    Permission.VACCINATION_CREATE,
    Permission.LABORATORY_VIEW,
    Permission.LABORATORY_RESULT_ENTER,
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

    const newOnes = new Set<string>(
      VaccinationAndLaboratoryPermissions1796000004000.NEW_PERMISSIONS,
    );
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
    const removed = VaccinationAndLaboratoryPermissions1796000004000.NEW_PERMISSIONS.map(
      (p) => `'${p}'`,
    ).join(', ');
    await queryRunner.query(`
      DELETE FROM "role_permissions" WHERE "permission"::text IN (${removed})
    `);

    const remaining = Object.values(Permission)
      .filter((p) => !VaccinationAndLaboratoryPermissions1796000004000.NEW_PERMISSIONS.includes(p))
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
