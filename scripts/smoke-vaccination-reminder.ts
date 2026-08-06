/**
 * Smoke test acceptance P9-T4 (nhac lich tiem) bang CSDL that.
 *
 * Cron chay 08:00 nen khong doi duoc trong mot phien lam viec - script nay dung Nest
 * application context de goi thang `publishDueReminders()`, dung cai ma `@Cron` goi.
 *
 * Chay: npx ts-node -r tsconfig-paths/register scripts/smoke-vaccination-reminder.ts
 *
 * =====================================================================================
 * CANH BAO: SCRIPT NAY SUA DU LIEU. No dat lai `next_due_date` cua MOI mui tiem (mot mui
 * thanh ngay mai, con lai thanh NULL) va bat/tat `active` cua mot khach hang, roi xoa cac
 * su kien outbox loai `VACCINATION_DUE`. Chi dung tren CSDL phat trien.
 *
 * Chot an toan o duoi tu choi chay khi `NODE_ENV=production`. Do la mot cai chan, khong
 * phai mot bao dam - CSDL phat trien tro toi mot moi truong that thi chot nay khong biet.
 * =====================================================================================
 */
import 'reflect-metadata';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { VaccinationReminderService } from '@/modules/clinical/application';
import { Vaccination } from '@/modules/clinical/domain/entities/vaccination.entity';
import { OutboxEvent } from '@/modules/notification/domain/entities/outbox-event.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { toDateOnly } from '@/modules/clinical/domain/vaccination-schedule.util';

const results: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
}

async function main() {
  config();

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Tu choi chay: script nay sua du lieu (xem canh bao dau file) va NODE_ENV=production.',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const reminders = app.get(VaccinationReminderService);
  const dataSource = app.get(DataSource);

  const tomorrow = toDateOnly(new Date(Date.now() + 86400000));

  // Don sach nhac cu de phep dem duoi day chi thay cai script nay sinh ra.
  await dataSource.query(`DELETE FROM "outbox_events" WHERE "type" = 'VACCINATION_DUE'`);

  const vaccinations = await dataSource.getRepository(Vaccination).find({ take: 2 });
  if (vaccinations.length === 0) {
    console.error('Chua co mui tiem nao trong CSDL - chay smoke-p9.mjs truoc.');
    await app.close();
    process.exitCode = 1;
    return;
  }

  const target = vaccinations[0];
  await dataSource
    .getRepository(Vaccination)
    .update({ id: target.id }, { nextDueDate: tomorrow });
  // Cac mui khac day ra ngoai cua so 7 ngay de phep dem khong lan.
  await dataSource.query(
    `UPDATE "vaccinations" SET "next_due_date" = NULL WHERE "id" <> $1`,
    [target.id],
  );

  const first = await reminders.publishDueReminders();
  const afterFirst = await dataSource
    .getRepository(OutboxEvent)
    .count({ where: { type: 'VACCINATION_DUE' } });
  check(
    'P9-T4 nextDueDate = ngay mai -> cron sinh dung mot su kien outbox',
    first === 1 && afterFirst === 1,
    `tra ve ${first}, outbox ${afterFirst}`,
  );

  const second = await reminders.publishDueReminders();
  const afterSecond = await dataSource
    .getRepository(OutboxEvent)
    .count({ where: { type: 'VACCINATION_DUE' } });
  check(
    'P9-T4 Chay cron hai lan trong ngay -> van chi mot su kien (dedupe)',
    afterSecond === 1,
    `lan 2 quet ${second} dong, outbox van ${afterSecond}`,
  );

  const event = await dataSource
    .getRepository(OutboxEvent)
    .findOne({ where: { type: 'VACCINATION_DUE' } });
  check(
    'P9-T4 dedupeKey gan voi (mui tiem, ngay hen), khong phai ngay chay cron',
    event?.dedupeKey === `vacc-due:${target.id}:${tomorrow}`,
    event?.dedupeKey,
  );
  check(
    'P9-T4 Payload du de worker soan tin (so dien thoai + noi dung)',
    Boolean(event?.payload?.recipientPhone && event?.payload?.message),
  );

  // Khach ngung hoat dong -> khong nhac.
  const pet = await dataSource.getRepository(Pet).findOne({ where: { id: target.petId } });
  const ownerId = pet!.ownerId;
  await dataSource.getRepository(User).update({ id: ownerId }, { active: false });
  await dataSource.query(`DELETE FROM "outbox_events" WHERE "type" = 'VACCINATION_DUE'`);

  const third = await reminders.publishDueReminders();
  const afterThird = await dataSource
    .getRepository(OutboxEvent)
    .count({ where: { type: 'VACCINATION_DUE' } });
  check(
    'P9-T4 Thu cung cua khach da ngung hoat dong -> khong nhac',
    third === 0 && afterThird === 0,
    `tra ve ${third}, outbox ${afterThird}`,
  );

  // Tra lai trang thai ban dau de khong lam ban du lieu demo.
  await dataSource.getRepository(User).update({ id: ownerId }, { active: true });
  await dataSource.query(`DELETE FROM "outbox_events" WHERE "type" = 'VACCINATION_DUE'`);

  await app.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

void main();
