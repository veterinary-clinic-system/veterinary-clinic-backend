import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryService, isExpired } from '@/modules/catalog/application';
import { InventoryBatch } from '@/modules/catalog/domain/entities/inventory-batch.entity';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { Vaccine } from '@/modules/catalog/domain/entities/vaccine.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Vaccination } from '@/modules/clinical/domain/entities/vaccination.entity';
import {
  VaccinationDueStatus,
  classifyDueDate,
  computeNextDueDate,
  toDateOnly,
} from '@/modules/clinical/domain/vaccination-schedule.util';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CreateVaccinationDto } from '@/modules/clinical/presentation/dto/create-vaccination.dto';
import { QueryVaccinationsDueDto } from '@/modules/clinical/presentation/dto/query-vaccinations-due.dto';

const DETAIL_RELATIONS = ['vaccine', 'vaccine.item', 'doctor', 'doctor.user'];

/** Mot mui trong so tiem chung, kem trang thai lich nhac da tinh san. */
export interface VaccinationRecordView {
  vaccination: Vaccination;
  /** `OVERDUE` to do, `DUE_SOON` to vang - acceptance P9-T3. */
  dueStatus: VaccinationDueStatus;
}

/** Mot dong trong danh sach goi nhac (`GET /vaccinations/due`). */
export interface VaccinationDueRow {
  vaccinationId: string;
  petId: string;
  petCode: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  vaccineId: string;
  vaccineName: string;
  diseasePrevented: string;
  doseNumber: number;
  vaccinatedAt: string;
  nextDueDate: string;
  /** Am = da qua han. */
  daysUntilDue: number;
  branchId: string;
}

/**
 * Tiem chung - SRS FR-12, BR-11 (P9-T2, P9-T3).
 *
 * BA DIEU LAM NEN TOAN BO SERVICE NAY:
 *
 *  1. TIEM LA TRU KHO. Mot mui tiem khong phai mot dong ghi chu - no lam mot liu
 *     vaccine roi khoi kho that. Viec tru di qua `InventoryService.issue` nhu moi thay
 *     doi ton khac (luat so mot cua P6), khong bao gio ghi thang.
 *  2. BR-11 CHAN CUNG. Vaccine het han khong duoc tiem. FEFO cua P6 da tu loai lo het
 *     han ra khoi phep phan bo, nhung khi CHI con lo het han no bao "khong du ton kho:
 *     kha dung 0" - dung ve so hoc, vo nghia voi nguoi dung. `assertUsableStock` bien
 *     tinh huong do thanh mot cau noi ro rang truoc khi cham vao kho.
 *  3. LO DA XUAT DUOC CHEP LAI. `batchNo`/`expiryDate` tren `vaccinations` lay tu chinh
 *     lo ma FEFO da chon, khong phai tu nguoi nhap - xem `CreateVaccinationDto`.
 *
 * Toan bo `create` nam trong MOT transaction: mot mui tiem da ghi ma kho chua tru (hoac
 * nguoc lai) la sai lech khong the phat hien duoc cho toi ky kiem ke.
 */
@Injectable()
export class VaccinationsService {
  constructor(
    @InjectRepository(Vaccination)
    private readonly vaccinationsRepository: Repository<Vaccination>,
    private readonly inventoryService: InventoryService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------- Ghi nhan

  /** Ghi nhan mot mui tiem va tru kho vaccine - FR-12, BR-11. */
  async create(
    dto: CreateVaccinationDto,
    actor: AuthenticatedUser,
  ): Promise<VaccinationRecordView> {
    const vaccinationId = await this.dataSource.transaction(async (em) => {
      const pet = await em.findOne(Pet, { where: { id: dto.petId } });
      if (!pet) {
        throw new NotFoundException('Pet not found');
      }

      const vaccine = await em.findOne(Vaccine, { where: { id: dto.vaccineId } });
      if (!vaccine) {
        throw new NotFoundException('Vaccine not found');
      }
      if (!vaccine.active) {
        throw new ConflictException('Vaccine nay da ngung su dung, khong ghi nhan mui tiem duoc');
      }

      const medicalRecord = await this.resolveMedicalRecord(em, dto, pet.id);
      const branchId = await this.resolveBranchId(em, dto, medicalRecord);
      const doctorId = await this.resolveDoctorId(em, actor, medicalRecord);

      const vaccinatedAt = dto.vaccinatedAt ? new Date(dto.vaccinatedAt) : new Date();
      const doseNumber = dto.doseNumber ?? (await this.nextDoseNumber(em, pet.id, vaccine.id));

      await this.assertUsableStock(em, vaccine, branchId);

      // Luu dong tiem TRUOC khi tru kho de co `id` lam `referenceId` cho so cai. Ca hai
      // nam trong cung transaction nen khong co cua so nao dong tiem ton tai ma kho chua
      // tru; doi lai so cai tro nguoc ve duoc dung mui tiem da sinh ra no.
      const vaccination = await em.save(
        em.create(Vaccination, {
          petId: pet.id,
          vaccineId: vaccine.id,
          medicalRecordId: medicalRecord?.id ?? null,
          doctorId,
          branchId,
          vaccinatedAt,
          doseNumber,
          batchNo: null,
          expiryDate: null,
          notes: dto.notes ?? null,
          nextDueDate:
            dto.nextDueDate !== undefined
              ? dto.nextDueDate
              : computeNextDueDate(vaccine, doseNumber, vaccinatedAt),
        }),
      );

      // MOT LIEU MOT MUI. Vaccine nhieu lieu trong mot lo hien khong co trong SRS; neu
      // ve sau can, cho so lieu vao DTO chu dung suy tu `doseCount` - `doseCount` la so
      // mui CUA PHAC DO, khong phai so lieu cua mot lan tiem.
      const [allocation] = await this.inventoryService.issue(
        {
          itemId: vaccine.itemId,
          branchId,
          quantity: 1,
          type: InventoryTransactionType.DISPENSE,
          referenceType: InventoryReferenceType.VACCINATION,
          referenceId: vaccination.id,
          performedByUserId: actor.userId,
          note: `Tiem vaccine ${vaccine.diseasePrevented} - mui ${doseNumber}`,
        },
        em,
      );

      const batch = await em.findOne(InventoryBatch, { where: { id: allocation.batchId } });
      await em.update(Vaccination, vaccination.id, {
        batchNo: allocation.batchNo,
        expiryDate: batch?.expiryDate ?? null,
      });

      return vaccination.id;
    });

    return this.findOne(vaccinationId);
  }

  // ----------------------------------------------------------------------- Doc

  async findOne(id: string): Promise<VaccinationRecordView> {
    const vaccination = await this.vaccinationsRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!vaccination) {
      throw new NotFoundException('Vaccination not found');
    }
    return this.toView(vaccination);
  }

  /** So tiem chung cua mot thu cung - moi gan nhat len truoc. */
  async findByPet(petId: string): Promise<VaccinationRecordView[]> {
    const vaccinations = await this.vaccinationsRepository.find({
      where: { petId },
      relations: DETAIL_RELATIONS,
      order: { vaccinatedAt: 'DESC' },
    });
    return vaccinations.map((vaccination) => this.toView(vaccination));
  }

  /** Cac mui da tiem trong mot lan kham - dung cho man hinh kham (P9-T3). */
  async findByMedicalRecord(medicalRecordId: string): Promise<VaccinationRecordView[]> {
    const vaccinations = await this.vaccinationsRepository.find({
      where: { medicalRecordId },
      relations: DETAIL_RELATIONS,
      order: { vaccinatedAt: 'ASC' },
    });
    return vaccinations.map((vaccination) => this.toView(vaccination));
  }

  /**
   * Cac mui den han trong `days` ngay toi - le tan goi nhac khach (FR-12).
   *
   * HAI DIEU KIEN KHONG HIEN NHIEN, va bo cai nao cung ra danh sach sai:
   *
   *  - `DISTINCT ON (pet_id, vaccine_id)` lay MUI GAN NHAT cua tung cap. Khi con cho
   *    tiem mui 2, `next_due_date` cua mui 1 tro thanh mot ngay trong qua khu da duoc
   *    dap ung roi. Khong loc thi moi mui cu deu bao "qua han" mai mai, va danh sach
   *    goi nhac se dai them mot dong sau moi lan tiem.
   *  - Khach ngung hoat dong thi khong goi (acceptance P9-T4). Ho so cu van tra cuu
   *    duoc binh thuong - day chi la loc cua danh sach NHAC.
   *
   * Khoang lay la `(-vo cuc, hom nay + days]`: mui qua han la cai can goi gap nhat, cat
   * no ra khoi danh sach thi khong con ai goi nua.
   */
  async findDue(query: QueryVaccinationsDueDto): Promise<VaccinationDueRow[]> {
    return this.dataSource.query(
      `
      SELECT * FROM (
        SELECT DISTINCT ON (v."pet_id", v."vaccine_id")
               v."id"                                     AS "vaccinationId",
               v."pet_id"                                 AS "petId",
               pet."pet_code"                             AS "petCode",
               pet."name"                                 AS "petName",
               owner."id"                                 AS "ownerId",
               owner."full_name"                          AS "ownerName",
               owner."phone"                              AS "ownerPhone",
               v."vaccine_id"                             AS "vaccineId",
               item."item_name"                           AS "vaccineName",
               vaccine."disease_prevented"                AS "diseasePrevented",
               v."dose_number"                            AS "doseNumber",
               v."vaccinated_at"                          AS "vaccinatedAt",
               to_char(v."next_due_date", 'YYYY-MM-DD')   AS "nextDueDate",
               (v."next_due_date" - CURRENT_DATE)         AS "daysUntilDue",
               v."branch_id"                              AS "branchId"
          FROM "vaccinations" v
          JOIN "pets" pet ON pet."id" = v."pet_id" AND pet."deleted_at" IS NULL
          JOIN "users" owner ON owner."id" = pet."owner_id" AND owner."deleted_at" IS NULL
          JOIN "vaccines" vaccine ON vaccine."id" = v."vaccine_id"
          JOIN "items" item ON item."id" = vaccine."item_id"
         WHERE v."deleted_at" IS NULL
           AND owner."active" = true
           AND ($2::uuid IS NULL OR v."branch_id" = $2::uuid)
         ORDER BY v."pet_id", v."vaccine_id", v."vaccinated_at" DESC, v."created_at" DESC
      ) latest
      WHERE "nextDueDate" IS NOT NULL
        AND "daysUntilDue" <= $1::int
      ORDER BY "daysUntilDue" ASC, "petName" ASC
      `,
      [query.days, query.branchId ?? null],
    );
  }

  // ------------------------------------------------------------------ Ben trong

  private toView(vaccination: Vaccination): VaccinationRecordView {
    return {
      vaccination,
      dueStatus: classifyDueDate(vaccination.nextDueDate, toDateOnly(new Date())),
    };
  }

  /**
   * BR-11 - vaccine het han khong duoc tiem.
   *
   * Phan biet HAI tinh huong ma nguoi dung xu ly khac han nhau, thay vi de ca hai roi
   * vao mot cau "khong du ton kho: kha dung 0" cua `InventoryService`:
   *   - con lo nhung TAT CA da het han -> phai HUY lo roi nhap lo moi, tuyet doi khong tiem;
   *   - khong con lo nao dung duoc      -> chi nhanh het hang, phai dat hang.
   *
   * Doc thang cac LO chu khong suy tu `inventoryQuantity`: hai con so do la mot bang
   * cache va mot su that (quyet dinh (B) cua P6), va suy nguoc tu cache se noi "chi con
   * lo het han" cho ca truong hop khong co lo nao ca - dung sai o dung cho nguoi dung
   * can duoc noi that.
   */
  private async assertUsableStock(
    em: EntityManager,
    vaccine: Vaccine,
    branchId: string,
  ): Promise<void> {
    const available = await this.inventoryService.getAvailable(vaccine.itemId, branchId, em);
    if (available > 0) {
      return;
    }

    const inventoryItem = await em.findOne(InventoryItem, {
      where: { itemId: vaccine.itemId, branchId },
    });
    if (inventoryItem) {
      const batches = await em.find(InventoryBatch, {
        where: { inventoryItemId: inventoryItem.id },
      });
      const today = toDateOnly(new Date());
      const expired = batches.filter((batch) => batch.quantity > 0 && isExpired(batch, today));
      if (expired.length > 0) {
        const detail = expired
          .map((batch) => `${batch.batchNo} (HSD ${batch.expiryDate})`)
          .join(', ');
        throw new ConflictException(
          `Vaccine "${vaccine.diseasePrevented}" o chi nhanh nay chi con lo DA HET HAN: ` +
            `${detail}. Khong duoc tiem (BR-11) - huy lo het han va nhap lo moi truoc.`,
        );
      }
    }
    throw new ConflictException(
      `Chi nhanh nay khong con vaccine "${vaccine.diseasePrevented}" trong kho`,
    );
  }

  /** Mui thu may = so mui da tiem cua chinh cap (thu cung, vaccine) nay, cong 1. */
  private async nextDoseNumber(
    em: EntityManager,
    petId: string,
    vaccineId: string,
  ): Promise<number> {
    const given = await em.count(Vaccination, { where: { petId, vaccineId } });
    return given + 1;
  }

  private async resolveMedicalRecord(
    em: EntityManager,
    dto: CreateVaccinationDto,
    petId: string,
  ): Promise<MedicalRecord | null> {
    if (!dto.medicalRecordId) {
      return null;
    }
    const medicalRecord = await em.findOne(MedicalRecord, { where: { id: dto.medicalRecordId } });
    if (!medicalRecord) {
      throw new NotFoundException('Medical record not found');
    }
    // Gan mui tiem vao ho so cua mot con khac la loi du lieu im lang nhat co the co
    // trong ca phase nay - no chi lo ra khi ai do doc so tiem chung nam sau.
    if (medicalRecord.petId !== petId) {
      throw new BadRequestException('Ho so benh an nay khong thuoc ve thu cung da chon');
    }
    return medicalRecord;
  }

  /**
   * Chi nhanh tru kho.
   *
   * Uu tien lich hen cua ho so benh an - cung ly do da ghi o `PrescriptionsService`:
   * lay chi nhanh cua nguoi dang dang nhap se tru nham kho khi bac si truc o chi nhanh
   * khac, va sai lech do khong ai phat hien duoc cho toi ky kiem ke. Chi khi tiem don le
   * (khong co ho so) moi dung `branchId` nguoi goi truyen len, roi den chi nhanh cua tai
   * khoan.
   */
  private async resolveBranchId(
    em: EntityManager,
    dto: CreateVaccinationDto,
    medicalRecord: MedicalRecord | null,
  ): Promise<string> {
    if (medicalRecord) {
      const appointment = await em.findOne(Appointment, {
        where: { id: medicalRecord.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found for this medical record');
      }
      return appointment.branchId;
    }
    if (dto.branchId) {
      return dto.branchId;
    }
    throw new BadRequestException(
      'Tiem don le (khong gan ho so benh an) phai chi ro `branchId` de biet tru kho o dau',
    );
  }

  /**
   * BR-07 cho mui tiem: mot mui tiem thuoc ve mot BAC SI.
   *
   * Cung khuon voi `MedicalRecordsService.resolveDoctorId` - ADMIN co toan quyen nhung
   * khong co ho so bac si, khi do ghi ten bac si phu trach ho so benh an. Khong co ca
   * hai thi tu choi: bia mot `doctorId` se lam sai thong ke o P10.
   */
  private async resolveDoctorId(
    em: EntityManager,
    actor: AuthenticatedUser,
    medicalRecord: MedicalRecord | null,
  ): Promise<string> {
    const doctor = await em.findOne(Doctor, { where: { userId: actor.userId } });
    if (doctor) {
      return doctor.id;
    }
    if (medicalRecord?.doctorId) {
      return medicalRecord.doctorId;
    }
    throw new ForbiddenException(
      'Tai khoan hien tai khong phai ho so bac si va mui tiem cung khong gan ho so benh an nao ' +
        'de lay bac si phu trach - khong xac dinh duoc nguoi tiem.',
    );
  }
}
