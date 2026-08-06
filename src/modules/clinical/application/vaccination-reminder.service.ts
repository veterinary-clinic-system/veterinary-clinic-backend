import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OutboxService } from '@/modules/notification/application';
import { toDateOnly } from '@/modules/clinical/domain/vaccination-schedule.util';

/**
 * Bao truoc bao nhieu ngay - acceptance P9-T4 doi 7 ngay.
 *
 * De o day va doc duoc qua bien moi truong, cung quy uoc voi
 * `INVENTORY_EXPIRING_SOON_DAYS`: phong kham dong khach can bao som hon de xep lich.
 */
const DEFAULT_REMINDER_LEAD_DAYS = 7;

/** Mot mui den han, du de soan tin nhac. */
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

/**
 * Nhac lich tiem - SRS FR-12, P9-T4.
 *
 * KHONG GUI THANG, ghi outbox roi de worker gui - dung kien truc Phan IV.2, cung mau voi
 * `InventoryAlertsService`. Gui thang tu cron thi mot lan chay loi giua chung se de lai
 * mot nua khach da duoc nhac va mot nua chua, khong lam lai duoc.
 *
 * `dedupeKey` = `vacc-due:<vaccinationId>:<nextDueDate>` - KHONG chua ngay chay cron.
 * Day la khac biet co chu dich so voi canh bao ton kho (`inv-alert:...:<hom nay>`, nhac
 * lai moi ngay cho toi khi duoc xu ly): mot mui tiem chi can nhac MOT LAN. Nhet ngay
 * chay vao khoa thi khach se nhan bay tin nhan giong het nhau trong bay ngay truoc han,
 * va do la cach nhanh nhat de ho tat thong bao. Bac si doi `nextDueDate` thi khoa doi
 * theo, va tin moi duoc gui - dung nhu mong doi.
 *
 * `DISTINCT ON (pet_id, vaccine_id)` lay mui GAN NHAT cua tung cap, cung ly do da giai
 * thich o `VaccinationsService.findDue`: khong loc thi moi mui cu deu bao qua han mai mai.
 */
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

  /**
   * Chay 08:00 moi ngay - sau canh bao ton kho (07:00) va truoc gio le tan bat dau goi
   * dien, de danh sach nhac cua ngay hom do da san sang khi ho ngoi vao ban.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async publishDueReminders(): Promise<number> {
    const rows = await this.queryDueVaccinations(this.leadDays);
    if (rows.length === 0) {
      return 0;
    }

    // Mot transaction cho ca me - cung ly do voi `InventoryAlertsService`: hoac ca me
    // nhac cua hom nay duoc ghi, hoac khong cai nao.
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

  /**
   * Cac mui den han trong `leadDays` ngay toi.
   *
   * KHONG lay mui da qua han - khac `VaccinationsService.findDue`, va day la mot khac
   * biet co y. Danh sach cua le tan la de NGUOI goi dien, nen mui qua han phai nam trong
   * do cho toi khi co nguoi xu ly. Tin nhan tu dong thi nguoc lai: mui qua han da tung
   * duoc nhac dung mot lan vao dung thoi diem cua no, va nhac lai moi ngay sau do la lam
   * phien - viec doi cua no la mot cu dien thoai, khong phai them mot tin nhan.
   *
   * Khach ngung hoat dong khong duoc nhac (acceptance P9-T4). Thu cung xoa mem cung vay.
   */
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
