import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { LaboratoryResult } from '@/modules/clinical/domain/entities/laboratory-result.entity';
import {
  computeLabResultFlag,
  isValidReferenceRange,
} from '@/modules/clinical/domain/lab-result-flag.util';
import { LabResultFlag } from '@/shared/common/enums/lab-result-flag.enum';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { LaboratoryResultDto } from '@/modules/clinical/presentation/dto/laboratory-result.dto';
import { SaveLaboratoryResultsDto } from '@/modules/clinical/presentation/dto/save-laboratory-results.dto';
import { QueryLabQueueDto } from '@/modules/clinical/presentation/dto/query-lab-queue.dto';

const ORDER_RELATIONS = ['results', 'technician'];

/** Mot diem tren duong xu huong cua mot chi so - P9-T6. */
export interface LabTrendPoint {
  labTestOrderId: string;
  testName: string;
  /** Moc do duoc: `resultDate` neu co, khong thi thoi diem chi dinh. */
  measuredAt: string;
  value: number;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: LabResultFlag;
}

/** Chuoi thoi gian cua mot chi so cua mot thu cung. */
export interface LabTrendSeries {
  parameter: string;
  /** Don vi cua diem gan nhat - dung de dat nhan truc tung. */
  unit: string | null;
  points: LabTrendPoint[];
}

/** Mot dong trong hang cho xet nghiem - P9-T7. */
export interface LabQueueRow {
  labTestOrderId: string;
  testName: string;
  status: LabTestStatus;
  orderedAt: string;
  medicalRecordId: string;
  petId: string;
  petCode: string;
  petName: string;
  doctorName: string | null;
  branchId: string;
  resultCount: number;
}

/**
 * Xet nghiem co cau truc - SRS FR-13 (P9-T5, T6, T7).
 *
 * NGOAI LE CO CHU DICH CUA BR-08. BR-08 noi ho so benh an da `COMPLETED` thi khong sua
 * duoc, va toan bo `MedicalRecordsService` thuc thi dieu do. Service NAY co tinh khong
 * kiem tra trang thai ho so khi luu ket qua xet nghiem, va do la mot quyet dinh chu
 * khong phai mot cho bo sot:
 *
 *   Ket qua xet nghiem VE MUON la truong hop BINH THUONG, khong phai ngoai le. Sinh hoa
 *   ve sau vai gio, mau gui ngoai vien ve sau vai ngay - trong khi bac si phai chot ho
 *   so va cho khach ra ve ngay trong buoi. Neu bat ho so con mo de cho ket qua thi hoac
 *   la ho so bi treo hang loat, hoac la ket qua ve roi khong co cho nao de ghi vao.
 *
 *   Cai BR-08 that su bao ve la KET LUAN CHUYEN MON cua bac si (chan doan, dieu tri,
 *   don thuoc) - nhung thu do van khoa cung. Ghi mot con so do duoc vao ho so khong sua
 *   ket luan nao ca; no BO SUNG bang chung, va bac si doc lai se thay ca hai.
 *
 * `parameter` duoc CHUAN HOA VE CHU HOA + cat khoang trang thua truoc khi luu: P9-T6 gom
 * nhom xu huong theo chinh chuoi nay, va "WBC" voi "wbc" go tu hai may khac nhau se ve
 * ra hai duong roi rac thay vi mot duong lien tuc.
 */
@Injectable()
export class LaboratoriesService {
  constructor(
    @InjectRepository(LabTestOrder)
    private readonly ordersRepository: Repository<LabTestOrder>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------- Tra ket qua

  /**
   * Luu (thay the) bang chi so cua mot yeu cau xet nghiem - FR-13-02.
   *
   * MOT TRANSACTION: xoa bang cu roi ghi bang moi. Loi giua chung se de lai mot ket qua
   * xet nghiem RONG tren mot ho so da `COMPLETED` - mat du lieu y te that, khong phuc
   * hoi duoc tu dau ca.
   *
   * Dua yeu cau ve `COMPLETED` va dong dau `resultDate` ngay trong cung lenh: bat ky
   * thuat vien nho bam them mot nut "danh dau da xong" nghia la som muon se co nhung
   * yeu cau co ket qua day du nhung van nam mai trong hang cho.
   */
  async saveResults(
    labTestOrderId: string,
    dto: SaveLaboratoryResultsDto,
    actor: AuthenticatedUser,
  ): Promise<LabTestOrder> {
    const order = await this.ordersRepository.findOne({ where: { id: labTestOrderId } });
    if (!order) {
      throw new NotFoundException('Lab test order not found');
    }
    this.assertNoDuplicateParameters(dto.results);

    await this.dataSource.transaction(async (em) => {
      await em.delete(LaboratoryResult, { labTestOrderId });

      if (dto.results.length > 0) {
        await em.save(
          dto.results.map((result) =>
            em.create(LaboratoryResult, this.toResultColumns(labTestOrderId, result)),
          ),
        );
      }

      await em.update(
        LabTestOrder,
        { id: labTestOrderId },
        {
          status: LabTestStatus.COMPLETED,
          resultDate: dto.resultDate ? new Date(dto.resultDate) : (order.resultDate ?? new Date()),
          technicianUserId: actor.userId,
          // `undefined` giu nguyen gia tri cu - ket qua dinh tinh cua lan truoc khong bi
          // xoa chi vi lan nay ky thuat vien khong nhac toi no.
          ...(dto.resultText !== undefined ? { resultText: dto.resultText } : {}),
        },
      );
    });

    return this.findOrder(labTestOrderId);
  }

  // ----------------------------------------------------------------------- Doc

  async findOrder(id: string): Promise<LabTestOrder> {
    const order = await this.ordersRepository.findOne({
      where: { id },
      relations: ORDER_RELATIONS,
      order: { results: { parameter: 'ASC' } },
    });
    if (!order) {
      throw new NotFoundException('Lab test order not found');
    }
    return order;
  }

  /** Cac yeu cau xet nghiem cua mot ho so benh an, kem bang chi so. */
  async findByMedicalRecord(medicalRecordId: string): Promise<LabTestOrder[]> {
    return this.ordersRepository.find({
      where: { medicalRecordId },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  /** Toan bo lich su xet nghiem cua mot thu cung - tab Xet nghiem (P9-T6). */
  async findByPet(petId: string): Promise<LabTestOrder[]> {
    return this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.results', 'result')
      .leftJoinAndSelect('order.technician', 'technician')
      .innerJoin('medical_records', 'record', 'record.id = order.medical_record_id')
      .where('record.pet_id = :petId', { petId })
      .orderBy('COALESCE(order.result_date, order.created_at)', 'DESC')
      .addOrderBy('result.parameter', 'ASC')
      .getMany();
  }

  /**
   * Chuoi thoi gian cua mot chi so - FR-13-02, acceptance P9-T6.
   *
   * Sap theo `COALESCE(result_date, created_at)` TANG dan: bieu do doc tu trai sang
   * phai. Khac moi danh sach khac trong he thong (moi nhat truoc) va do la co y.
   *
   * Thu cung chua xet nghiem lan nao tra ve `points: []` chu khong phai 404: giao dien
   * can phan biet "chua co du lieu" (hien empty state) voi "khong tim thay thu cung"
   * (hien loi), va ca hai deu tra 404 thi khong phan biet duoc.
   */
  async findTrends(petId: string, parameter: string): Promise<LabTrendSeries> {
    const normalized = this.normalizeParameter(parameter);

    const points: LabTrendPoint[] = await this.dataSource.query(
      `
      SELECT "order"."id"                                              AS "labTestOrderId",
             "order"."test_name"                                       AS "testName",
             COALESCE("order"."result_date", "order"."created_at")      AS "measuredAt",
             result."value"::float8                                     AS "value",
             result."unit"                                              AS "unit",
             result."reference_min"::float8                             AS "referenceMin",
             result."reference_max"::float8                             AS "referenceMax",
             result."flag"                                              AS "flag"
        FROM "laboratory_results" result
        JOIN "lab_test_orders" "order"
          ON "order"."id" = result."lab_test_order_id" AND "order"."deleted_at" IS NULL
        JOIN "medical_records" record
          ON record."id" = "order"."medical_record_id" AND record."deleted_at" IS NULL
       WHERE result."deleted_at" IS NULL
         AND record."pet_id" = $1::uuid
         AND result."parameter" = $2
       ORDER BY COALESCE("order"."result_date", "order"."created_at") ASC
      `,
      [petId, normalized],
    );

    return {
      parameter: normalized,
      unit: points.length > 0 ? points[points.length - 1].unit : null,
      points,
    };
  }

  /** Cac ten chi so da tung do cho mot thu cung - de giao dien dung o chon chi so. */
  async findParameters(petId: string): Promise<string[]> {
    const rows: { parameter: string }[] = await this.dataSource.query(
      `
      SELECT DISTINCT result."parameter" AS "parameter"
        FROM "laboratory_results" result
        JOIN "lab_test_orders" "order"
          ON "order"."id" = result."lab_test_order_id" AND "order"."deleted_at" IS NULL
        JOIN "medical_records" record
          ON record."id" = "order"."medical_record_id" AND record."deleted_at" IS NULL
       WHERE result."deleted_at" IS NULL
         AND record."pet_id" = $1::uuid
       ORDER BY result."parameter" ASC
      `,
      [petId],
    );
    return rows.map((row) => row.parameter);
  }

  /**
   * Hang cho xet nghiem - acceptance P9-T7.
   *
   * Cu nhat len TRUOC (`ASC`), cung quy uoc voi hang cho quay thuoc o P7: viec cho lau
   * nhat phai duoc lam truoc.
   */
  async findQueue(query: QueryLabQueueDto): Promise<LabQueueRow[]> {
    return this.dataSource.query(
      `
      SELECT "order"."id"                              AS "labTestOrderId",
             "order"."test_name"                       AS "testName",
             "order"."status"                          AS "status",
             "order"."created_at"                      AS "orderedAt",
             "order"."medical_record_id"               AS "medicalRecordId",
             pet."id"                                  AS "petId",
             pet."pet_code"                            AS "petCode",
             pet."name"                                AS "petName",
             doctor_user."full_name"                   AS "doctorName",
             appointment."branch_id"                   AS "branchId",
             COUNT(result."id")::int                   AS "resultCount"
        FROM "lab_test_orders" "order"
        JOIN "medical_records" record
          ON record."id" = "order"."medical_record_id" AND record."deleted_at" IS NULL
        JOIN "pets" pet ON pet."id" = record."pet_id"
        JOIN "appointments" appointment ON appointment."id" = record."appointment_id"
        LEFT JOIN "doctors" doctor ON doctor."id" = record."doctor_id"
        LEFT JOIN "users" doctor_user ON doctor_user."id" = doctor."user_id"
        LEFT JOIN "laboratory_results" result
          ON result."lab_test_order_id" = "order"."id" AND result."deleted_at" IS NULL
       WHERE "order"."deleted_at" IS NULL
         AND ($1::text IS NULL OR "order"."status"::text = $1::text)
         AND ($1::text IS NOT NULL OR "order"."status"::text <> 'COMPLETED')
         AND ($2::uuid IS NULL OR appointment."branch_id" = $2::uuid)
       GROUP BY "order"."id", pet."id", doctor_user."full_name", appointment."branch_id"
       ORDER BY "order"."created_at" ASC
      `,
      [query.status ?? null, query.branchId ?? null],
    );
  }

  // ------------------------------------------------------------------ Ben trong

  private toResultColumns(labTestOrderId: string, dto: LaboratoryResultDto) {
    const referenceMin = dto.referenceMin ?? null;
    const referenceMax = dto.referenceMax ?? null;
    if (!isValidReferenceRange({ referenceMin, referenceMax })) {
      throw new BadRequestException(
        `Chi so "${dto.parameter}": can duoi cua khoang tham chieu lon hon can tren`,
      );
    }

    return {
      labTestOrderId,
      parameter: this.normalizeParameter(dto.parameter),
      value: dto.value,
      unit: dto.unit ?? null,
      referenceMin,
      referenceMax,
      // Bac si truyen `flag` = ghi de; bo trong = he thong tinh. Ca hai nhanh deu ghi
      // `flagOverridden` tuong ung de lan luu sau khong xoa mat quyet dinh cua nguoi.
      flag: dto.flag ?? computeLabResultFlag(dto.value, { referenceMin, referenceMax }),
      flagOverridden: dto.flag !== undefined,
      note: dto.note ?? null,
    };
  }

  /**
   * Chi muc unique `(lab_test_order_id, parameter)` cung chan trung o CSDL, nhung bao
   * bang mot loi 400 co ten chi so thi ky thuat vien sua duoc ngay; de CSDL bao thi
   * nguoi dung nhan mot thong bao rang buoc khong doc duoc.
   */
  private assertNoDuplicateParameters(results: readonly LaboratoryResultDto[]): void {
    const seen = new Set<string>();
    for (const result of results) {
      const parameter = this.normalizeParameter(result.parameter);
      if (seen.has(parameter)) {
        throw new BadRequestException(
          `Chi so "${parameter}" xuat hien hai lan trong cung mot ket qua xet nghiem`,
        );
      }
      seen.add(parameter);
    }
  }

  /** Xem ghi chu dau lop ve ly do chuan hoa. */
  private normalizeParameter(parameter: string): string {
    return parameter.trim().replace(/\s+/g, ' ').toUpperCase();
  }
}
