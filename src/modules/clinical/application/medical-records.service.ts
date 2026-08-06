import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Treatment } from '@/modules/clinical/domain/entities/treatment.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  AppointmentStatus,
  TERMINAL_APPOINTMENT_STATUSES,
  isValidAppointmentStatusTransition,
} from '@/shared/common/enums/appointment-status.enum';
import { MedicalRecordStatus } from '@/shared/common/enums/medical-record-status.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CreateDiagnosisDto } from '@/modules/clinical/presentation/dto/create-diagnosis.dto';
import { CreateTreatmentDto } from '@/modules/clinical/presentation/dto/create-treatment.dto';
import { OpenMedicalRecordDto } from '@/modules/clinical/presentation/dto/open-medical-record.dto';
import { UpdateDiagnosisDto } from '@/modules/clinical/presentation/dto/update-diagnosis.dto';
import { UpdateMedicalRecordDto } from '@/modules/clinical/presentation/dto/update-medical-record.dto';
import { UpdateTreatmentDto } from '@/modules/clinical/presentation/dto/update-treatment.dto';
import { AmendMedicalRecordDto } from '@/modules/clinical/presentation/dto/amend-medical-record.dto';
import { Role } from '@/shared/common/enums/role.enum';

/** Do quan he cho mot lan doc CHI TIET - dung cac khoi SRS doi (FR-07). */
const MEDICAL_RECORD_DETAIL_RELATIONS = [
  'appointment',
  'appointment.service',
  'appointment.branch',
  'pet',
  'pet.owner',
  'pet.breed',
  'pet.breed.species',
  'doctor',
  'doctor.user',
  'examination',
  'diagnoses',
  'treatments',
  'prescriptions',
  'prescriptions.items',
  'prescriptions.items.medication',
  'prescriptions.items.medication.item',
  'labTestOrders',
  // P9-T7: ket qua xet nghiem ve MUON la binh thuong (xem `LaboratoriesService`), nen
  // bac si mo lai ho so - ke ca ho so da `COMPLETED` - phai thay ngay bang chi so vua
  // duoc ky thuat vien nhap, khong phai mo them mot man hinh khac de tra cuu.
  'labTestOrders.results',
  'vaccinations',
  'vaccinations.vaccine',
  'vaccinations.vaccine.item',
];

/** Danh sach benh su: du de dung mot dong tom tat, khong keo theo ca don thuoc. */
const MEDICAL_RECORD_TIMELINE_RELATIONS = ['appointment', 'doctor', 'examination', 'diagnoses'];

/**
 * Vong doi ho so benh an - SRS FR-07..FR-10, BR-07, BR-08.
 *
 * Service nay la CUA DUY NHAT ghi vao `medical_records`, `diagnoses`, `treatments`.
 * Ly do gom lai mot cho thay vi ba service: ba bang do la MOT aggregate - luat BR-08
 * ("ho so da hoan tat khong sua duoc") phai ap cho ca chan doan va dieu tri, khong chi
 * cho phan than. Neu tach ra, moi service lai phai tu di hoi trang thai ho so cha va
 * chi can mot cho quen la BR-08 thung.
 */
@Injectable()
export class MedicalRecordsService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordsRepository: Repository<MedicalRecord>,
    @InjectRepository(Diagnosis) private readonly diagnosesRepository: Repository<Diagnosis>,
    @InjectRepository(Treatment) private readonly treatmentsRepository: Repository<Treatment>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------------
  // Vong doi ho so
  // ---------------------------------------------------------------------------------

  /**
   * Mo ho so `DRAFT` cho mot lich hen. IDEMPOTENT: goi lan thu hai tra ve dung ho so
   * da co, khong tao ban thu hai va khong bao loi - man hinh kham (UC-03) goi thang
   * endpoint nay moi lan bac si bam "Phieu kham", ke ca khi dang kham do.
   *
   * Advisory lock theo `appointmentId` (cung khuon voi
   * `BillingService.generateForAppointment`): hai tab cung bam "Phieu kham" mot luc
   * khong duoc phep cung vuot qua kiem tra "da ton tai chua" roi cung INSERT. Chi muc
   * `uq_medical_records_appointment` la chot chan cuoi, nhung de no bat thi nguoi dung
   * nhan mot loi 500 kho hieu thay vi ho so cua minh.
   *
   * **BR-06**: chi mo duoc khi lich hen da CHECKED_IN/IN_PROGRESS - le tan phai tiep
   * nhan truoc. Mo ho so cho mot lich PENDING nghia la ghi benh an cho con vat chua
   * bao gio buoc vao phong kham.
   */
  async openForAppointment(
    dto: OpenMedicalRecordDto,
    actor: AuthenticatedUser,
  ): Promise<MedicalRecord> {
    const opened = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [dto.appointmentId]);

      const existing = await manager.findOne(MedicalRecord, {
        where: { appointmentId: dto.appointmentId },
      });
      if (existing) {
        return existing;
      }

      const appointment = await manager.findOne(Appointment, {
        where: { id: dto.appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException('Không tìm thấy lịch hẹn');
      }

      this.assertAppointmentIsInExamination(appointment);

      const record = manager.create(MedicalRecord, {
        appointmentId: appointment.id,
        // Luon lay tu chinh lich hen, khong nhan tu client: `pet_id` la ban sao
        // denormalise, sai mot lan la benh su cua con vat khac bi tron vao.
        petId: appointment.petId,
        doctorId: await this.resolveDoctorId(actor, appointment),
        visitReason: dto.visitReason ?? null,
        generalCondition: dto.generalCondition ?? null,
        notes: dto.notes ?? null,
        status: MedicalRecordStatus.DRAFT,
        completedAt: null,
      });
      return manager.save(record);
    });

    return this.findOne(opened.id);
  }

  /** Chi tiet day du - 7 khoi trong MOT request (khong bat giao dien goi 5 lan). */
  async findOne(id: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordsRepository.findOne({
      where: { id },
      relations: MEDICAL_RECORD_DETAIL_RELATIONS,
      order: { diagnoses: { createdAt: 'ASC' }, treatments: { createdAt: 'ASC' } },
    });
    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
    }
    return record;
  }

  async findByAppointment(appointmentId: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordsRepository.findOne({ where: { appointmentId } });
    if (!record) {
      throw new NotFoundException('Lịch hẹn này chưa có hồ sơ bệnh án');
    }
    return this.findOne(record.id);
  }

  /** Sua phan than ho so. **BR-08**: chi khi con `DRAFT`. */
  async update(id: string, dto: UpdateMedicalRecordDto): Promise<MedicalRecord> {
    const record = await this.loadOrThrow(id);
    this.assertEditable(record);

    await this.medicalRecordsRepository.update(id, {
      ...(dto.visitReason !== undefined ? { visitReason: dto.visitReason } : {}),
      ...(dto.generalCondition !== undefined ? { generalCondition: dto.generalCondition } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    return this.findOne(id);
  }

  /**
   * Sua ho so DA HOAN TAT - SRS FR-08, P10-T2.
   *
   * BR-08 cam sua ho so `COMPLETED`, va `update()` o tren thuc thi dieu do. Nhung FR-08
   * viet day du la: *"Neu can sua, phai luu audit log"* - tuc SRS luon du tinh se co
   * duong sua, kem dieu kien. Day la duong do, va ba dieu kien lam nen no:
   *
   *   1. `reason` BAT BUOC (xem `AmendMedicalRecordDto`);
   *   2. chi ADMIN hoac CHINH BAC SI da lap ho so - nguoi khac 403. Mot bac si khac
   *      khong duoc sua ket luan chuyen mon ma minh khong dua ra;
   *   3. moi lan goi deu sinh mot dong `audit_logs` (decorator `@Audit` tren handler).
   *
   * PHAM VI HEP CO CHU DICH: chi ba truong mo ta cua chinh ho so. Chan doan, dieu tri va
   * don thuoc KHONG sua duoc qua day - chung la ban ghi rieng, va sua chung phai di qua
   * chinh chung de con vet. Endpoint nay danh cho truong hop that: go nham ly do kham,
   * ghi thieu mot cau tinh trang, chot ho so som mot phut.
   */
  async amend(
    id: string,
    dto: AmendMedicalRecordDto,
    actor: AuthenticatedUser,
  ): Promise<MedicalRecord> {
    const record = await this.loadOrThrow(id);

    if (record.status !== MedicalRecordStatus.COMPLETED) {
      throw new ConflictException(
        'Hồ sơ này chưa hoàn tất - hãy sửa bằng đường thông thường (PATCH /medical-records/:id).',
      );
    }
    await this.assertCanAmend(record, actor);

    await this.medicalRecordsRepository.update(id, {
      ...(dto.visitReason !== undefined ? { visitReason: dto.visitReason } : {}),
      ...(dto.generalCondition !== undefined ? { generalCondition: dto.generalCondition } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    return this.findOne(id);
  }

  /**
   * Chot ho so: `DRAFT` -> `COMPLETED`, dat `completedAt`, va tu day BR-08 khoa moi
   * duong sua.
   *
   * Dong thoi dong luon lich hen thanh `COMPLETED` trong CUNG transaction. Day la
   * diem ket thuc THAT SU cua mot lan kham theo UC-03 - truoc P4, viec do do
   * `ExaminationsService.create` lam, tuc lich hen bi dong ngay khi bac si vua ghi
   * sinh hieu, truoc ca khi co chan doan.
   *
   * Goi lai tren ho so da `COMPLETED` -> 409 chu khong im lang tra ve: khac voi
   * `openForAppointment`, "hoan tat" khong phai thao tac lap lai vo hai - nguoi dung
   * bam hai lan can biet lan hai khong lam gi.
   */
  async complete(id: string): Promise<MedicalRecord> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);

      const record = await manager.findOne(MedicalRecord, { where: { id } });
      if (!record) {
        throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
      }
      if (record.status === MedicalRecordStatus.COMPLETED) {
        throw new ConflictException('Hồ sơ bệnh án này đã được hoàn tất trước đó.');
      }

      await manager.update(MedicalRecord, id, {
        status: MedicalRecordStatus.COMPLETED,
        completedAt: new Date(),
      });

      const appointment = await manager.findOne(Appointment, {
        where: { id: record.appointmentId },
      });
      // Lich hen co the da COMPLETED san (duong cu qua `ExaminationsService.create`,
      // hoac mot ho so duoc mo lai tren du lieu backfill) - `from === to` van hop le
      // nen nhanh nay khong bao loi, chi khong ghi gi them.
      if (
        appointment &&
        appointment.status !== AppointmentStatus.COMPLETED &&
        isValidAppointmentStatusTransition(appointment.status, AppointmentStatus.COMPLETED)
      ) {
        await manager.update(Appointment, appointment.id, {
          status: AppointmentStatus.COMPLETED,
        });
      }
    });

    return this.findOne(id);
  }

  /**
   * Benh su cua mot thu cung - thay `PetsService.getTimeline`.
   *
   * Doc thang tu `medical_records.pet_id` (cot denormalise) thay vi join nguoc qua
   * `appointments`; chi muc `idx_medical_records_pet_created` phuc vu dung truy van
   * nay. Ca ho so `DRAFT` cung tra ve: bac si dang kham can nhin thay lan kham dang do
   * cua chinh minh, va man hinh kham (UC-03) dung chinh danh sach nay lam cot trai.
   */
  async getTimelineForPet(petId: string): Promise<MedicalRecord[]> {
    const petExists = await this.petsRepository.count({ where: { id: petId } });
    if (petExists === 0) {
      throw new NotFoundException('Không tìm thấy thú cưng');
    }

    return this.medicalRecordsRepository.find({
      where: { petId },
      relations: MEDICAL_RECORD_TIMELINE_RELATIONS,
      order: { createdAt: 'DESC' },
    });
  }

  // ---------------------------------------------------------------------------------
  // Chan doan (FR-09)
  // ---------------------------------------------------------------------------------

  async addDiagnosis(medicalRecordId: string, dto: CreateDiagnosisDto): Promise<Diagnosis> {
    const record = await this.loadOrThrow(medicalRecordId);
    this.assertEditable(record);

    return this.dataSource.transaction(async (manager) => {
      // Chan doan DAU TIEN cua ho so mac dinh la chan doan chinh: mot ho so co chan
      // doan ma khong co cai nao "chinh" thi bao cao P10 khong quy duoc lan kham vao
      // benh nao. Khi client noi ro `isPrimary` thi nghe client.
      const existingCount = await manager.count(Diagnosis, { where: { medicalRecordId } });
      const isPrimary = dto.isPrimary ?? existingCount === 0;

      if (isPrimary) {
        await this.demoteCurrentPrimary(manager, medicalRecordId, null);
      }

      const diagnosis = manager.create(Diagnosis, {
        medicalRecordId,
        diseaseId: dto.diseaseId ?? null,
        diagnosisText: dto.diagnosisText,
        severity: dto.severity ?? undefined,
        notes: dto.notes ?? null,
        isPrimary,
      });
      return manager.save(diagnosis);
    });
  }

  async updateDiagnosis(id: string, dto: UpdateDiagnosisDto): Promise<Diagnosis> {
    const diagnosis = await this.diagnosesRepository.findOne({ where: { id } });
    if (!diagnosis) {
      throw new NotFoundException('Không tìm thấy chẩn đoán');
    }
    this.assertEditable(await this.loadOrThrow(diagnosis.medicalRecordId));

    return this.dataSource.transaction(async (manager) => {
      if (dto.isPrimary === true) {
        await this.demoteCurrentPrimary(manager, diagnosis.medicalRecordId, id);
      }

      await manager.update(Diagnosis, id, {
        ...(dto.diseaseId !== undefined ? { diseaseId: dto.diseaseId } : {}),
        ...(dto.diagnosisText !== undefined ? { diagnosisText: dto.diagnosisText } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
      });

      return manager.findOneOrFail(Diagnosis, { where: { id } });
    });
  }

  /**
   * Xoa mem mot chan doan. Neu do la chan doan CHINH va ho so van con chan doan khac,
   * chan doan cu nhat con lai duoc nang len lam chinh - de ho so khong roi vao trang
   * thai "co chan doan nhung khong biet cai nao la chinh".
   */
  async removeDiagnosis(id: string): Promise<void> {
    const diagnosis = await this.diagnosesRepository.findOne({ where: { id } });
    if (!diagnosis) {
      throw new NotFoundException('Không tìm thấy chẩn đoán');
    }
    this.assertEditable(await this.loadOrThrow(diagnosis.medicalRecordId));

    await this.dataSource.transaction(async (manager) => {
      await manager.softDelete(Diagnosis, id);

      if (!diagnosis.isPrimary) return;

      const successor = await manager.findOne(Diagnosis, {
        where: { medicalRecordId: diagnosis.medicalRecordId, id: Not(id) },
        order: { createdAt: 'ASC' },
      });
      if (successor) {
        await manager.update(Diagnosis, successor.id, { isPrimary: true });
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // Dieu tri (FR-10)
  // ---------------------------------------------------------------------------------

  async addTreatment(medicalRecordId: string, dto: CreateTreatmentDto): Promise<Treatment> {
    const record = await this.loadOrThrow(medicalRecordId);
    this.assertEditable(record);

    const startDate = toDateOnly(dto.startDate);
    const endDate = dto.endDate ? toDateOnly(dto.endDate) : null;
    assertDateOrder(startDate, endDate);

    const treatment = this.treatmentsRepository.create({
      medicalRecordId,
      method: dto.method,
      description: dto.description ?? null,
      startDate,
      endDate,
      instruction: dto.instruction ?? null,
      notes: dto.notes ?? null,
    });
    return this.treatmentsRepository.save(treatment);
  }

  async updateTreatment(id: string, dto: UpdateTreatmentDto): Promise<Treatment> {
    const treatment = await this.treatmentsRepository.findOne({ where: { id } });
    if (!treatment) {
      throw new NotFoundException('Không tìm thấy phương pháp điều trị');
    }
    this.assertEditable(await this.loadOrThrow(treatment.medicalRecordId));

    // Doi chieu tren gia tri SAU khi gop DTO vao ban ghi hien co: PATCH chi gui
    // `endDate` van phai so voi `startDate` dang luu, khong the bo qua.
    const startDate = dto.startDate !== undefined ? toDateOnly(dto.startDate) : treatment.startDate;
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate === null
          ? null
          : toDateOnly(dto.endDate)
        : treatment.endDate;
    assertDateOrder(startDate, endDate);

    await this.treatmentsRepository.update(id, {
      ...(dto.method !== undefined ? { method: dto.method } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.startDate !== undefined ? { startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate } : {}),
      ...(dto.instruction !== undefined ? { instruction: dto.instruction } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    return this.treatmentsRepository.findOneOrFail({ where: { id } });
  }

  async removeTreatment(id: string): Promise<void> {
    const treatment = await this.treatmentsRepository.findOne({ where: { id } });
    if (!treatment) {
      throw new NotFoundException('Không tìm thấy phương pháp điều trị');
    }
    this.assertEditable(await this.loadOrThrow(treatment.medicalRecordId));

    await this.treatmentsRepository.softDelete(id);
  }

  // ---------------------------------------------------------------------------------
  // Dung chung
  // ---------------------------------------------------------------------------------

  private async loadOrThrow(id: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordsRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
    }
    return record;
  }

  /**
   * **BR-08** - "Khong duoc sua ho so benh an da hoan tat."
   *
   * Ap cho ca phan than LAN chan doan/dieu tri con: chung la mot aggregate, sua mot
   * chan doan cua ho so da chot cung la sua ho so do.
   *
   * SRS FR-08 co mo mot cua: *"Neu can sua, phai luu audit log"*. Cua do CHUA mo o
   * phase nay - P10 dung tang audit roi moi mo duong sua-co-vet. O day chi chan.
   */
  private assertEditable(record: MedicalRecord): void {
    if (record.status === MedicalRecordStatus.COMPLETED) {
      throw new ConflictException(
        'Hồ sơ bệnh án đã hoàn tất nên không thể chỉnh sửa (BR-08). ' +
          'Mọi thay đổi sau khi hoàn tất phải đi qua đường sửa có ghi nhật ký kiểm toán.',
      );
    }
  }

  /**
   * BR-06 - phai tiep nhan truoc khi kham. Hai truong hop bi chan, hai thong bao khac
   * nhau vi cach xu ly khac nhau: lich da ket thuc thi khong lam gi duoc nua, lich
   * chua check-in thi ra quay le tan la xong.
   */
  private assertAppointmentIsInExamination(appointment: Appointment): void {
    if (
      appointment.status === AppointmentStatus.CHECKED_IN ||
      appointment.status === AppointmentStatus.IN_PROGRESS
    ) {
      return;
    }

    throw new ConflictException(
      TERMINAL_APPOINTMENT_STATUSES.has(appointment.status)
        ? `Không thể mở hồ sơ bệnh án cho lịch hẹn đã ở trạng thái kết thúc ("${appointment.status}").`
        : 'Chưa tiếp nhận thú cưng nên chưa thể mở hồ sơ bệnh án - vui lòng check-in tại quầy lễ tân trước (BR-06).',
    );
  }

  /**
   * Ai duoc sua mot ho so da chot - dieu kien (2) cua `amend`.
   *
   * ADMIN duoc, vi phai co mot duong sua khi bac si da nghi viec. Ngoai ra CHI bac si da
   * lap chinh ho so do. Khong mo cho MANAGER: quan ly co quyen quan tri he thong nhung
   * khong co tham quyen chuyen mon de sua mot ket luan y te.
   */
  private async assertCanAmend(record: MedicalRecord, actor: AuthenticatedUser): Promise<void> {
    if (actor.role === Role.ADMIN) {
      return;
    }
    const doctor = await this.doctorsRepository.findOne({ where: { userId: actor.userId } });
    if (doctor && doctor.id === record.doctorId) {
      return;
    }
    throw new ForbiddenException(
      'Chỉ quản trị viên hoặc chính bác sĩ đã lập hồ sơ mới được sửa hồ sơ đã hoàn tất (FR-08).',
    );
  }

  /**
   * BR-07 - ho so benh an thuoc ve mot BAC SI.
   *
   * Nguoi dang nhap thuong chinh la bac si do. Nhung ADMIN cung co
   * `MEDICAL_RECORD_CREATE` (ma tran quyen: toan quyen) va khong co ho so bac si -
   * khi do ho so ghi ten bac si DUOC PHAN CONG cho lich hen, khong phai ten admin.
   * Bia mot `doctorId` khac di se lam sai thong ke nang suat bac si o P10.
   */
  private async resolveDoctorId(
    actor: AuthenticatedUser,
    appointment: Appointment,
  ): Promise<string> {
    const doctor = await this.doctorsRepository.findOne({ where: { userId: actor.userId } });
    if (doctor) {
      return doctor.id;
    }
    if (appointment.doctorId) {
      return appointment.doctorId;
    }
    throw new ForbiddenException(
      'Tài khoản hiện tại không phải hồ sơ bác sĩ và lịch hẹn cũng chưa có bác sĩ phụ trách (BR-07).',
    );
  }

  /**
   * Ha chan doan chinh dang co xuong truoc khi dat cai moi len - chi muc
   * `uq_diagnoses_one_primary` chi cho phep dung mot, nen hai buoc nay bat buoc phai
   * nam trong cung mot transaction.
   */
  private async demoteCurrentPrimary(
    manager: EntityManager,
    medicalRecordId: string,
    exceptId: string | null,
  ): Promise<void> {
    await manager.update(
      Diagnosis,
      exceptId
        ? { medicalRecordId, isPrimary: true, id: Not(exceptId) }
        : { medicalRecordId, isPrimary: true },
      { isPrimary: false },
    );
  }
}

/**
 * Cot `date` cua Postgres khong giu mui gio. Cat phan gio cua chuoi ISO do
 * `@IsDateString()` chap nhan ("2026-08-04T00:00:00.000Z") de khong bao gio ghi mot
 * ngay lech mot don vi so voi ngay nguoi dung go.
 */
function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

/** SRS FR-10: mot khoang dieu tri ket thuc truoc khi bat dau la du lieu vo nghia. */
function assertDateOrder(startDate: string, endDate: string | null): void {
  if (endDate && endDate < startDate) {
    throw new BadRequestException('Ngày kết thúc điều trị không được trước ngày bắt đầu.');
  }
}
