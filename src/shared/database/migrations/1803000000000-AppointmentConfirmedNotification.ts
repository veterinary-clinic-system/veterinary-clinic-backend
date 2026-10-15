import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppointmentConfirmedNotification1803000000000 implements MigrationInterface {
  name = 'AppointmentConfirmedNotification1803000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tin xác nhận ngay khi đặt lịch (Zalo + Gmail) - trước đây chỉ có nhắc/đổi/hủy.
    await queryRunner.query(`
      ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CONFIRMED'
    `);
  }

  public async down(): Promise<void> {
    // Postgres không xoá được một giá trị khỏi enum; để nguyên là vô hại.
  }
}
