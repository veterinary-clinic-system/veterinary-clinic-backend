import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { InventoryService } from '@/modules/catalog/application';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { PrescriptionItem } from '@/modules/clinical/domain/entities/prescription-item.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  InventoryReferenceType,
  InventoryTransactionType,
} from '@/shared/common/enums/inventory-transaction-type.enum';
import {
  EDITABLE_PRESCRIPTION_STATUSES,
  PrescriptionStatus,
  isValidPrescriptionStatusTransition,
} from '@/shared/common/enums/prescription-status.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreatePrescriptionDto } from '@/modules/clinical/presentation/dto/create-prescription.dto';
import { PrescriptionItemDto } from '@/modules/clinical/presentation/dto/prescription-item.dto';
import { QueryPrescriptionsDto } from '@/modules/clinical/presentation/dto/query-prescriptions.dto';
import { UpdatePrescriptionDto } from '@/modules/clinical/presentation/dto/update-prescription.dto';

const DETAIL_RELATIONS = ['items', 'items.medication', 'items.medication.item'];
const SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt', 'dispensedAt']);

/** Tinh trang kho cua mot dong thuoc, tinh tai thoi diem doc - FR-11-02. */
export interface PrescriptionItemStock {
  prescriptionItemId: string;
  medicationId: string;
  medicationName: string;
  /** So bac si ke. */
  requested: number;
  /** So dung duoc o chi nhanh kham, DA loai lo het han (BR-11). */
  availableQuantity: number;
  insufficientStock: boolean;
}

/** Don thuoc kem tinh trang kho tung dong - dang tra ve cua moi endpoint doc mot don. */
export interface PrescriptionView {
  prescription: Prescription;
  branchId: string;
  stockCheck: PrescriptionItemStock[];
  /** Co bat ky dong nao thieu tong khong - de FE khoa nut cap phat ma khong phai tu do. */
  hasInsufficientStock: boolean;
}

/**
 * Don thuoc va cap phat - SRS FR-11, BR-10, BR-11.
 *
 * HAI MUC DO NGHIEM NGAT KHAC NHAU voi cung mot phep kiem tra ton kho, day la diem cot
 * loi cua phase 7:
 *
 *   - KE DON (`create`/`update`): CANH BAO, khong chan. FR-11-02 viet "he thong NEN
 *     kiem tra". Bac si phai ke duoc thuoc benh nhan can du kho tam het - de duoc si
 *     biet duong nhap gap hoac de xuat doi thuoc. Chan o day nghia la lay quyet dinh
 *     chuyen mon ra khoi tay nguoi co chuyen mon.
 *   - CAP PHAT (`dispense`): CHAN CUNG (BR-10). Den buoc nay thuoc dang duoc dua cho
 *     khach that; khong the giao thu khong co trong kho.
 *
 * Va vi the: `create` KHONG dong gi toi ton kho. Truoc P7, `ExaminationsService` tru
 * kho ngay luc ke don - vua sai nghiep vu (ke khong phai la giao) vua ghi thang vao
 * `inventory_items`, bo qua lo va so cai, tuc la pha bat bien cua P6. Toan bo viec tru
 * kho gio nam o `dispense` va di qua `InventoryService`.
 */
@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionsRepository: Repository<Prescription>,
    private readonly inventoryService: InventoryService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------- Ke don

  /**
   * Ke mot don thuoc vao mot ho so benh an.
   *
   * Khong tru kho, khong chan khi thieu hang - chi tra ve `stockCheck` de giao dien to
   * do nhung dong dang thieu. Xem comment dau lop.
   */
  async create(
    medicalRecordId: string,
    dto: CreatePrescriptionDto,
    manager?: EntityManager,
  ): Promise<PrescriptionView> {
    const em = manager ?? this.dataSource.manager;

    const medicalRecord = await em.findOne(MedicalRecord, { where: { id: medicalRecordId } });
    if (!medicalRecord) {
      throw new NotFoundException('Medical record not found');
    }
    await this.assertMedicationsExist(em, dto.items);

    const prescription = await em.save(
      em.create(Prescription, {
        medicalRecordId,
        notes: dto.notes ?? null,
        status: PrescriptionStatus.PRESCRIBED,
        items: dto.items.map((item) => em.create(PrescriptionItem, this.toItemColumns(item))),
      }),
    );

    return this.viewOf(prescription.id);
  }

  // --------------------------------------------------------------------- Doc

  async findAll(query: QueryPrescriptionsDto): Promise<PaginatedResultDto<Prescription>> {
    const qb = this.prescriptionsRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'item')
      .leftJoinAndSelect('item.medication', 'medication')
      .leftJoinAndSelect('medication.item', 'catalogItem')
      .innerJoin('medical_records', 'record', 'record.id = prescription.medical_record_id')
      .innerJoin('appointments', 'appointment', 'appointment.id = record.appointment_id');

    if (query.status) {
      qb.andWhere('prescription.status = :status', { status: query.status });
    }
    if (query.medicalRecordId) {
      qb.andWhere('prescription.medicalRecordId = :medicalRecordId', {
        medicalRecordId: query.medicalRecordId,
      });
    }
    if (query.petId) {
      qb.andWhere('record.pet_id = :petId', { petId: query.petId });
    }
    if (query.branchId) {
      qb.andWhere('appointment.branch_id = :branchId', { branchId: query.branchId });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    // Hang cho quay thuoc: don cho lau nhat phai duoc soan truoc, nen mac dinh la ASC -
    // nguoc voi cac danh sach khac trong he thong. Xem `QueryPrescriptionsDto`.
    const defaultOrder = query.status === PrescriptionStatus.PRESCRIBED ? 'ASC' : 'DESC';
    qb.orderBy(`prescription.${sortBy}`, query.sortOrder ?? defaultOrder)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /** Mot don kem tinh trang kho tung dong. */
  async findOne(id: string): Promise<PrescriptionView> {
    return this.viewOf(id);
  }

  /** Cac don thuoc cua mot ho so benh an. */
  async findByMedicalRecord(medicalRecordId: string): Promise<Prescription[]> {
    return this.prescriptionsRepository.find({
      where: { medicalRecordId },
      relations: DETAIL_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  // ------------------------------------------------------------------- Sua don

  /** Acceptance P7-T2: don da `DISPENSED` (hoac dang soan/da huy) thi khong sua duoc. */
  async update(id: string, dto: UpdatePrescriptionDto): Promise<PrescriptionView> {
    const prescription = await this.loadOrThrow(id);
    if (!EDITABLE_PRESCRIPTION_STATUSES.has(prescription.status)) {
      throw new ConflictException(
        `Don thuoc dang o trang thai ${prescription.status}, khong sua duoc nua`,
      );
    }
    if (dto.items) {
      await this.assertMedicationsExist(this.dataSource.manager, dto.items);
    }

    await this.dataSource.transaction(async (em) => {
      if (dto.items) {
        await em.delete(PrescriptionItem, { prescriptionId: id });
        await em.save(
          dto.items.map((item) =>
            em.create(PrescriptionItem, { prescriptionId: id, ...this.toItemColumns(item) }),
          ),
        );
      }
      if (dto.notes !== undefined) {
        await em.update(Prescription, { id }, { notes: dto.notes });
      }
    });

    return this.viewOf(id);
  }

  /** Duoc si nhan don ve quay - `PRESCRIBED` -> `DISPENSING`. Chua dong toi kho. */
  async startDispensing(id: string): Promise<PrescriptionView> {
    await this.transitionTo(id, PrescriptionStatus.DISPENSING);
    return this.viewOf(id);
  }

  async cancel(id: string): Promise<PrescriptionView> {
    await this.transitionTo(id, PrescriptionStatus.CANCELLED);
    return this.viewOf(id);
  }

  // ---------------------------------------------------------------- Cap phat

  /**
   * Cap phat va tru kho - BR-10, NFR-07.
   *
   * MOT TRANSACTION CHO CA DON. Tru kho duoc 3 tren 5 loai thuoc roi loi la tinh huong
   * phai tuyet doi tranh: khach cam ve mot phan don, kho da tru mot phan, va khong ai
   * biet phan nao. Moi loi o bat ky dong nao deu keo ca don ve nguyen trang.
   *
   * `pg_advisory_xact_lock` theo `prescriptionId` chan hai duoc si cung bam "cap phat"
   * mot don: nguoi thu hai se doi, roi doc lai trang thai da la `DISPENSED` va nhan 409.
   * Khong co khoa nay thi ca hai cung qua duoc phep kiem tra trang thai va kho bi tru
   * doi - acceptance P7-T4 doi dung tinh huong nay.
   *
   * Kiem tra du hang cho TOAN BO cac dong TRUOC khi tru dong nao: nguoi dung can biet
   * ca don thieu nhung gi de di lay bu mot lan, chu khong phai bam - bao thieu - bo sung
   * - bam lai nam lan.
   */
  async dispense(id: string, dispensedByUserId?: string): Promise<PrescriptionView> {
    await this.dataSource.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`prescription:${id}`]);

      const prescription = await em.findOne(Prescription, {
        where: { id },
        relations: DETAIL_RELATIONS,
      });
      if (!prescription) {
        throw new NotFoundException('Prescription not found');
      }
      if (prescription.status === PrescriptionStatus.DISPENSED) {
        throw new ConflictException('Don thuoc nay da duoc cap phat roi');
      }
      if (!isValidPrescriptionStatusTransition(prescription.status, PrescriptionStatus.DISPENSED)) {
        throw new ConflictException(
          `Khong the cap phat don dang o trang thai ${prescription.status}`,
        );
      }

      const branchId = await this.branchIdOf(em, prescription.medicalRecordId);
      const items = prescription.items ?? [];
      if (items.length === 0) {
        throw new ConflictException('Don thuoc khong co dong nao de cap phat');
      }

      // Gom moi dong thieu vao MOT thong bao - xem comment dau ham.
      const shortages: string[] = [];
      for (const item of items) {
        const available = await this.inventoryService.getAvailable(
          item.medication.itemId,
          branchId,
          em,
        );
        if (available < item.quantity) {
          shortages.push(
            `${item.medication.item.itemName}: can ${item.quantity}, kha dung ${available}`,
          );
        }
      }
      if (shortages.length > 0) {
        throw new ConflictException(`Khong du ton kho de cap phat - ${shortages.join('; ')}`);
      }

      for (const item of items) {
        await this.inventoryService.issue(
          {
            itemId: item.medication.itemId,
            branchId,
            quantity: item.quantity,
            type: InventoryTransactionType.DISPENSE,
            referenceType: InventoryReferenceType.PRESCRIPTION,
            referenceId: prescription.id,
            performedByUserId: dispensedByUserId ?? null,
            note: `Cap phat theo don thuoc ${prescription.id}`,
          },
          em,
        );
      }

      await em.update(
        Prescription,
        { id },
        {
          status: PrescriptionStatus.DISPENSED,
          dispensedByUserId: dispensedByUserId ?? null,
          dispensedAt: new Date(),
        },
      );
    });

    return this.viewOf(id);
  }

  // ------------------------------------------------------------------ Ben trong

  private async transitionTo(id: string, next: PrescriptionStatus): Promise<void> {
    const prescription = await this.loadOrThrow(id);
    if (!isValidPrescriptionStatusTransition(prescription.status, next)) {
      throw new ConflictException(
        `Khong the chuyen don thuoc tu ${prescription.status} sang ${next}`,
      );
    }
    await this.prescriptionsRepository.update({ id }, { status: next });
  }

  private async loadOrThrow(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionsRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    return prescription;
  }

  /**
   * Doc mot don kem tinh trang kho tung dong.
   *
   * Ton duoc doc tai THOI DIEM DOC chu khong luu vao don: mot con so ton chup lai luc
   * ke don se sai ngay sau lan ban hang tiep theo, va giao dien quay thuoc can so that
   * o thoi diem duoc si dang nhin.
   */
  private async viewOf(id: string): Promise<PrescriptionView> {
    const prescription = await this.loadOrThrow(id);
    const branchId = await this.branchIdOf(this.dataSource.manager, prescription.medicalRecordId);

    const stockCheck: PrescriptionItemStock[] = [];
    for (const item of prescription.items ?? []) {
      const availableQuantity = await this.inventoryService.getAvailable(
        item.medication.itemId,
        branchId,
      );
      stockCheck.push({
        prescriptionItemId: item.id,
        medicationId: item.medicationId,
        medicationName: item.medication.item.itemName,
        requested: item.quantity,
        availableQuantity,
        insufficientStock: availableQuantity < item.quantity,
      });
    }

    return {
      prescription,
      branchId,
      stockCheck,
      hasInsufficientStock: stockCheck.some((line) => line.insufficientStock),
    };
  }

  /**
   * Chi nhanh de tru kho = chi nhanh cua lan kham sinh ra ho so.
   *
   * Khong lay chi nhanh cua nguoi dang dang nhap: duoc si o quay co the co `branchId`
   * khac (hoac null voi ADMIN), va tru kho nham chi nhanh la loi khong ai phat hien
   * duoc cho toi ky kiem ke.
   */
  private async branchIdOf(em: EntityManager, medicalRecordId: string): Promise<string> {
    const record = await em.findOne(MedicalRecord, { where: { id: medicalRecordId } });
    if (!record) {
      throw new NotFoundException('Medical record not found');
    }
    const appointment = await em.findOne(Appointment, { where: { id: record.appointmentId } });
    if (!appointment) {
      throw new NotFoundException('Appointment not found for this medical record');
    }
    return appointment.branchId;
  }

  private async assertMedicationsExist(
    em: EntityManager,
    items: readonly PrescriptionItemDto[],
  ): Promise<void> {
    const medicationIds = [...new Set(items.map((item) => item.medicationId))];
    const medications = await em.find(Medication, { where: { id: In(medicationIds) } });
    if (medications.length !== medicationIds.length) {
      const found = new Set(medications.map((m) => m.id));
      const missing = medicationIds.filter((medicationId) => !found.has(medicationId));
      throw new NotFoundException(`Medication(s) not found: ${missing.join(', ')}`);
    }
  }

  private toItemColumns(item: PrescriptionItemDto) {
    if (item.quantity <= 0) {
      throw new BadRequestException('So luong thuoc phai la so nguyen duong');
    }
    return {
      medicationId: item.medicationId,
      quantity: item.quantity,
      dosage: item.dosage,
      frequency: item.frequency ?? null,
      durationDays: item.durationDays,
      route: item.route,
      instructions: item.instructions ?? null,
    };
  }
}
