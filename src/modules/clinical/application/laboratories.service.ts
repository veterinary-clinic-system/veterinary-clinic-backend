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

export interface LabTrendPoint {
  labTestOrderId: string;
  testName: string;
  
  measuredAt: string;
  value: number;
  unit: string | null;
  referenceMin: number | null;
  referenceMax: number | null;
  flag: LabResultFlag;
}

export interface LabTrendSeries {
  parameter: string;
  
  unit: string | null;
  points: LabTrendPoint[];
}

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

@Injectable()
export class LaboratoriesService {
  constructor(
    @InjectRepository(LabTestOrder)
    private readonly ordersRepository: Repository<LabTestOrder>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

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

          ...(dto.resultText !== undefined ? { resultText: dto.resultText } : {}),
        },
      );
    });

    return this.findOrder(labTestOrderId);
  }

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

  async findByMedicalRecord(medicalRecordId: string): Promise<LabTestOrder[]> {
    return this.ordersRepository.find({
      where: { medicalRecordId },
      relations: ORDER_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

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

      flag: dto.flag ?? computeLabResultFlag(dto.value, { referenceMin, referenceMax }),
      flagOverridden: dto.flag !== undefined,
      note: dto.note ?? null,
    };
  }

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

  private normalizeParameter(parameter: string): string {
    return parameter.trim().replace(/\s+/g, ' ').toUpperCase();
  }
}
