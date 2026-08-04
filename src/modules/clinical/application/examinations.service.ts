import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { PrescriptionItem } from '@/modules/clinical/domain/entities/prescription-item.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecordStatus } from '@/shared/common/enums/medical-record-status.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MedicalRecordsService } from '@/modules/clinical/application/medical-records.service';
import { CreateExaminationDto } from '@/modules/clinical/presentation/dto/create-examination.dto';
import { UpdateExaminationDto } from '@/modules/clinical/presentation/dto/update-examination.dto';
import { CreatePrescriptionDto } from '@/modules/clinical/presentation/dto/create-prescription.dto';
import { CreateLabTestDto } from '@/modules/clinical/presentation/dto/create-lab-test.dto';
import { UpdateLabTestDto } from '@/modules/clinical/presentation/dto/update-lab-test.dto';

/**
 * Full relation graph for "detail" reads (GET by id/by-appointment, PDF export).
 * `prescriptions.items.medication`/`.medication.item` and `appointment.pet.breed.*` are
 * technically eager on their owning entities already, but are listed explicitly anyway -
 * mirrors the convention already established in appointments.service.ts's `findOne`
 * (`relations: [..., 'service', 'service.item']` despite Service.item being eager).
 */
const EXAMINATION_DETAIL_RELATIONS = [
  'appointment',
  'appointment.pet',
  'appointment.pet.owner',
  'appointment.pet.breed',
  'appointment.pet.breed.species',
  'appointment.doctor',
  'appointment.branch',
  'doctor',
  // Don thuoc va chi dinh xet nghiem treo duoi HO SO chu khong duoi phieu kham tu
  // P4-T6. Van nap o day (them mot chang `medicalRecord`) de phieu kham PDF - thu
  // duy nhat con doc chung qua duong nay - khong doi hinh dang.
  'medicalRecord',
  'medicalRecord.diagnoses',
  'medicalRecord.treatments',
  'medicalRecord.prescriptions',
  'medicalRecord.prescriptions.items',
  'medicalRecord.prescriptions.items.medication',
  'medicalRecord.prescriptions.items.medication.item',
  'medicalRecord.labTestOrders',
];

@Injectable()
export class ExaminationsService {
  constructor(
    @InjectRepository(Examination) private readonly examinationsRepository: Repository<Examination>,
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
    @InjectRepository(Prescription)
    private readonly prescriptionsRepository: Repository<Prescription>,
    @InjectRepository(LabTestOrder)
    private readonly labTestOrdersRepository: Repository<LabTestOrder>,
    @InjectRepository(Medication) private readonly medicationsRepository: Repository<Medication>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly medicalRecordsService: MedicalRecordsService,
  ) {}

  /**
   * Section 4.1.4 exam-entry form - phan SINH HIEU cua mot lan kham.
   *
   * Tu P4, viec dau tien la MO HO SO BENH AN cho lich hen (idempotent - dung lai ho so
   * co san neu man hinh kham da mo truoc do) roi gan phieu kham vao ho so do. Moi luat
   * BR-06 nam trong `MedicalRecordsService.openForAppointment`, khong lap lai o day.
   *
   * KHONG con dong lich hen thanh COMPLETED nua: tu P4, dieu do do
   * `MedicalRecordsService.complete()` lam. Truoc day, chi vua ghi xong sinh hieu la
   * lich hen da bi dong - truoc ca khi bac si kip nhap chan doan hay dieu tri.
   */
  async create(dto: CreateExaminationDto, actor: AuthenticatedUser): Promise<Examination> {
    const doctor = await this.doctorsRepository.findOne({ where: { userId: actor.userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found for the current user');
    }

    const existing = await this.examinationsRepository.findOne({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing) {
      throw new ConflictException(
        'An examination already exists for this appointment - use PATCH to edit it',
      );
    }

    const record = await this.medicalRecordsService.openForAppointment(
      { appointmentId: dto.appointmentId },
      actor,
    );
    this.assertRecordEditable(record);

    const created = await this.examinationsRepository.save(
      this.examinationsRepository.create({
        appointmentId: dto.appointmentId,
        medicalRecordId: record.id,
        doctorId: doctor.id,
        diseaseGroups: dto.diseaseGroups ?? [],
        diagnosisText: dto.diagnosisText ?? null,
        notes: dto.notes ?? null,
        temperatureCelsius: dto.temperatureCelsius ?? null,
        weightKg: dto.weightKg ?? null,
        heartRateBpm: dto.heartRateBpm ?? null,
        respiratoryRateBpm: dto.respiratoryRateBpm ?? null,
        attachmentUrls: dto.attachmentUrls ?? [],
      }),
    );

    return this.findOne(created.id);
  }

  /** **BR-08**: sinh hieu la mot phan cua ho so, ho so da chot thi cung khong sua duoc. */
  async update(id: string, dto: UpdateExaminationDto): Promise<Examination> {
    await this.assertExists(id);
    await this.assertParentRecordEditable(id);

    await this.examinationsRepository.update(id, {
      ...(dto.diseaseGroups !== undefined ? { diseaseGroups: dto.diseaseGroups } : {}),
      ...(dto.diagnosisText !== undefined ? { diagnosisText: dto.diagnosisText } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.temperatureCelsius !== undefined
        ? { temperatureCelsius: dto.temperatureCelsius }
        : {}),
      ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
      ...(dto.heartRateBpm !== undefined ? { heartRateBpm: dto.heartRateBpm } : {}),
      ...(dto.respiratoryRateBpm !== undefined
        ? { respiratoryRateBpm: dto.respiratoryRateBpm }
        : {}),
      ...(dto.attachmentUrls !== undefined ? { attachmentUrls: dto.attachmentUrls } : {}),
    });

    return this.findOne(id);
  }

  async findOne(id: string): Promise<Examination> {
    const examination = await this.examinationsRepository.findOne({
      where: { id },
      relations: EXAMINATION_DETAIL_RELATIONS,
    });
    if (!examination) {
      throw new NotFoundException('Examination not found');
    }
    return examination;
  }

  async findByAppointment(appointmentId: string): Promise<Examination> {
    const examination = await this.examinationsRepository.findOne({
      where: { appointmentId },
      relations: EXAMINATION_DETAIL_RELATIONS,
    });
    if (!examination) {
      throw new NotFoundException('No examination found for this appointment');
    }
    return examination;
  }

  /**
   * Section 4.1.4: "Prescribe medication: dosage, number of days" - one submit = one
   * Prescription.
   *
   * Duong vao van la id PHIEU KHAM (giao dien hien tai goi
   * `POST /examinations/:id/prescriptions`) nhung don thuoc duoc ghi vao HO SO cua
   * phieu kham do - khoa ngoai da doi o P4-T6.
   */
  async createPrescription(
    examinationId: string,
    dto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    const examination = await this.examinationsRepository.findOne({
      where: { id: examinationId },
      relations: ['appointment', 'medicalRecord'],
    });
    if (!examination) {
      throw new NotFoundException('Examination not found');
    }
    const medicalRecordId = this.requireMedicalRecordId(examination);

    const medicationIds = [...new Set(dto.items.map((item) => item.medicationId))];
    const medications = await this.medicationsRepository.find({ where: { id: In(medicationIds) } });
    if (medications.length !== medicationIds.length) {
      const foundIds = new Set(medications.map((m) => m.id));
      const missing = medicationIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Medication(s) not found: ${missing.join(', ')}`);
    }
    const medicationById = new Map(medications.map((m) => [m.id, m]));

    const saved = await this.dataSource.transaction(async (manager) => {
      // Prescription.items has { cascade: true } (see prescription.entity.ts) so saving
      // the Prescription with its `items` array populated inserts both in one go.
      const prescription = manager.create(Prescription, {
        medicalRecordId,
        notes: dto.notes ?? null,
        items: dto.items.map((item) =>
          manager.create(PrescriptionItem, {
            medicationId: item.medicationId,
            dosage: item.dosage,
            durationDays: item.durationDays,
            instructions: item.instructions ?? null,
          }),
        ),
      });
      const savedPrescription = await manager.save(prescription);

      // Tru kho tai chi nhanh noi kham, cung transaction voi viec tao don thuoc - ke
      // don va tru kho phai thanh cong/that bai cung nhau. `durationDays` duoc dung
      // lam so luong (cung mot gia dinh da neu trong billing.service.ts: `dosage` chi
      // la text tu do "1 vien x 2 lan/ngay", khong co tan suat co cau truc de nhan
      // chinh xac hon).
      //
      // Neu KHONG co ban ghi InventoryItem cho (thuoc, chi nhanh) nay - bo qua, khong
      // bao loi: khong phai thuoc nao cung bat buoc phai quan ly ton kho qua man hinh
      // Inventory. Neu CO ban ghi nhung khong du - chan toan bo don thuoc (giu dung quy
      // uoc da co san o InventoryService.update(): so luong ket qua khong duoc am), bat
      // le tan/bac si biet ma bo sung kho truoc khi hoan tat don, thay vi de kho am
      // trong im lang.
      for (const item of dto.items) {
        const medication = medicationById.get(item.medicationId)!;
        const inventoryItem = await manager.findOne(InventoryItem, {
          where: { itemId: medication.itemId, branchId: examination.appointment.branchId },
        });
        if (!inventoryItem) continue;

        const remaining = inventoryItem.inventoryQuantity - item.durationDays;
        if (remaining < 0) {
          throw new ConflictException(
            `Khong du ton kho cho thuoc "${medication.item.itemName}" tai chi nhanh nay ` +
              `(con ${inventoryItem.inventoryQuantity}, can ${item.durationDays})`,
          );
        }
        await manager.update(InventoryItem, inventoryItem.id, { inventoryQuantity: remaining });
      }

      return savedPrescription;
    });

    return this.prescriptionsRepository.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.medication', 'items.medication.item'],
    }) as Promise<Prescription>;
  }

  async listPrescriptions(examinationId: string): Promise<Prescription[]> {
    const medicalRecordId = this.requireMedicalRecordId(await this.loadOrThrow(examinationId));
    return this.prescriptionsRepository.find({
      where: { medicalRecordId },
      relations: ['items', 'items.medication', 'items.medication.item'],
      order: { createdAt: 'ASC' },
    });
  }

  /** Section 4.1.4: "order lab tests" - result is filled in later via updateLabTest. */
  async createLabTest(examinationId: string, dto: CreateLabTestDto): Promise<LabTestOrder> {
    const examination = await this.loadOrThrow(examinationId);
    const labTest = this.labTestOrdersRepository.create({
      medicalRecordId: this.requireMedicalRecordId(examination),
      testName: dto.testName,
    });
    return this.labTestOrdersRepository.save(labTest);
  }

  /**
   * Result files themselves are uploaded via `POST /files/upload?category=lab-results`
   * (owned by the files module); this only records the returned URLs plus status/result text.
   */
  async updateLabTest(labTestId: string, dto: UpdateLabTestDto): Promise<LabTestOrder> {
    const labTest = await this.labTestOrdersRepository.findOne({ where: { id: labTestId } });
    if (!labTest) {
      throw new NotFoundException('Lab test order not found');
    }

    await this.labTestOrdersRepository.update(labTestId, {
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.resultText !== undefined ? { resultText: dto.resultText } : {}),
      ...(dto.resultFileUrls !== undefined ? { resultFileUrls: dto.resultFileUrls } : {}),
    });

    return this.labTestOrdersRepository.findOne({
      where: { id: labTestId },
    }) as Promise<LabTestOrder>;
  }

  private async assertExists(examinationId: string): Promise<void> {
    const count = await this.examinationsRepository.count({ where: { id: examinationId } });
    if (count === 0) {
      throw new NotFoundException('Examination not found');
    }
  }

  private async loadOrThrow(examinationId: string): Promise<Examination> {
    const examination = await this.examinationsRepository.findOne({ where: { id: examinationId } });
    if (!examination) {
      throw new NotFoundException('Examination not found');
    }
    return examination;
  }

  /**
   * Tu P4-T6, don thuoc va chi dinh xet nghiem deu treo duoi ho so benh an. Mot phieu
   * kham khong co ho so chi con sinh ra tu du lieu cu chua duoc backfill - khong am
   * tham tao ho so o day, vi tao ho so can biet bac si va trang thai lich hen.
   */
  private requireMedicalRecordId(examination: Examination): string {
    if (!examination.medicalRecordId) {
      throw new ConflictException(
        'Phiếu khám này chưa gắn với hồ sơ bệnh án nào nên chưa thể kê đơn hay chỉ định xét nghiệm.',
      );
    }
    return examination.medicalRecordId;
  }

  /** **BR-08** - chan moi duong ghi khi ho so cha da hoan tat. */
  private async assertParentRecordEditable(examinationId: string): Promise<void> {
    const examination = await this.examinationsRepository.findOne({
      where: { id: examinationId },
      relations: ['medicalRecord'],
    });
    if (examination?.medicalRecord) {
      this.assertRecordEditable(examination.medicalRecord);
    }
  }

  private assertRecordEditable(record: MedicalRecord): void {
    if (record.status === MedicalRecordStatus.COMPLETED) {
      throw new ConflictException(
        'Hồ sơ bệnh án đã hoàn tất nên không thể chỉnh sửa phiếu khám (BR-08).',
      );
    }
  }
}
