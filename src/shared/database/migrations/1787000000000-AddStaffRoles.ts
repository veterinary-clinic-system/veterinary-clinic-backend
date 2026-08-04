import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Them 3 vai tro cua SRS muc 4 con thieu: MANAGER, PHARMACIST, STAFF.
 *
 * Migration nay CHI lam mot viec va phai dung rieng mot file. Postgres cho phep
 * `ALTER TYPE ... ADD VALUE` ben trong transaction (tu phien ban 12), NHUNG gia tri
 * vua them KHONG dung duoc trong chinh transaction do. Neu gop chung voi migration
 * seed `role_permissions` (co INSERT ... VALUES ('MANAGER', ...)), lenh seed se that
 * bai voi loi "unsafe use of new value of enum type".
 *
 * Khong co `down`: Postgres khong ho tro xoa mot gia tri khoi kieu enum. Muon lui
 * that su thi phai tao kieu moi, doi cot sang kieu do va xoa kieu cu - viec do rui ro
 * hon nhieu so voi viec de lai ba gia tri khong dung toi.
 */
export class AddStaffRoles1787000000000 implements MigrationInterface {
  name = 'AddStaffRoles1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const role of ['MANAGER', 'PHARMACIST', 'STAFF']) {
      await queryRunner.query(
        `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS '${role}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Xem ghi chu o tren - khong the go mot gia tri khoi kieu enum cua Postgres.
  }
}
