import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS, Permission } from '@/shared/common/enums/permission.enum';

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
