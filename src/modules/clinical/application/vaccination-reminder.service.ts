import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxService } from '@/modules/notification/application';
import { toDateOnly } from '@/modules/clinical/domain/vaccination-schedule.util';

const DEFAULT_REMINDER_LEAD_DAYS = 7;

interface DueVaccinationRow {
  vaccinationId: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  vaccineName: string;
  diseasePrevented: string;
  doseNumber: number;
  nextDueDate: string;
  branchId: string;
}

@Injectable()
export class VaccinationReminderService {
  private readonly logger = new Logger(VaccinationReminderService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {}

  private get leadDays(): number {
    const configured = Number(process.env.VACCINATION_REMINDER_LEAD_DAYS);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_REMINDER_LEAD_DAYS;
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async publishDueReminders(): Promise<number> {
    const rows = await this.queryDueVaccinations(this.leadDays);
    if (rows.length === 0) {
      return 0;
    }

    await this.dataSource.transaction(async (em) => {
      for (const row of rows) {
        await this.outboxService.record(em, {
          type: 'VACCINATION_DUE',
          dedupeKey: `vacc-due:${row.vaccinationId}:${row.nextDueDate}`,
          payload: {
            vaccinationId: row.vaccinationId,
            petId: row.petId,
            petName: row.petName,
            ownerId: row.ownerId,
            recipientPhone: row.ownerPhone,
            vaccineName: row.vaccineName,
            diseasePrevented: row.diseasePrevented,
            doseNumber: row.doseNumber,
            nextDueDate: row.nextDueDate,
            branchId: row.branchId,
            message:
              `Nhac lich tiem: ${row.petName} den han tiem ${row.vaccineName} ` +
              `(${row.diseasePrevented}) ngay ${row.nextDueDate}. ` +
              'Vui long lien he phong kham de dat lich.',
          },
        });
      }
    });

    this.logger.log(`Da ghi ${rows.length} nhac lich tiem vao outbox (${toDateOnly(new Date())})`);
    return rows.length;
  }

  private queryDueVaccinations(leadDays: number): Promise<DueVaccinationRow[]> {
    return this.dataSource.query(
      `
      SELECT * FROM (
        SELECT DISTINCT ON (v."pet_id", v."vaccine_id")
               v."id"                                     AS "vaccinationId",
               v."pet_id"                                 AS "petId",
               pet."name"                                 AS "petName",
               owner."id"                                 AS "ownerId",
               owner."full_name"                          AS "ownerName",
               owner."phone"                              AS "ownerPhone",
               item."item_name"                           AS "vaccineName",
               vaccine."disease_prevented"                AS "diseasePrevented",
               v."dose_number"                            AS "doseNumber",
               to_char(v."next_due_date", 'YYYY-MM-DD')   AS "nextDueDate",
               (v."next_due_date" - CURRENT_DATE)         AS "daysUntilDue",
               v."branch_id"                              AS "branchId"
          FROM "vaccinations" v
          JOIN "pets" pet ON pet."id" = v."pet_id" AND pet."deleted_at" IS NULL
          JOIN "users" owner ON owner."id" = pet."owner_id" AND owner."deleted_at" IS NULL
          JOIN "vaccines" vaccine ON vaccine."id" = v."vaccine_id"
          JOIN "items" item ON item."id" = vaccine."item_id"
         WHERE v."deleted_at" IS NULL
           AND v."next_due_date" IS NOT NULL
           AND owner."active" = true
         ORDER BY v."pet_id", v."vaccine_id", v."vaccinated_at" DESC, v."created_at" DESC
      ) latest
      WHERE "daysUntilDue" BETWEEN 0 AND $1::int
      ORDER BY "daysUntilDue" ASC
      `,
      [leadDays],
    );
  }
}
