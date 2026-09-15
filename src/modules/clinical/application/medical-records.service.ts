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

  'labTestOrders.results',
  'vaccinations',
  'vaccinations.vaccine',
  'vaccinations.vaccine.item',
];

const MEDICAL_RECORD_TIMELINE_RELATIONS = ['appointment', 'doctor', 'examination', 'diagnoses'];

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

  async addDiagnosis(medicalRecordId: string, dto: CreateDiagnosisDto): Promise<Diagnosis> {
    const record = await this.loadOrThrow(medicalRecordId);
    this.assertEditable(record);

    return this.dataSource.transaction(async (manager) => {

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

  private async loadOrThrow(id: string): Promise<MedicalRecord> {
    const record = await this.medicalRecordsRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
    }
    return record;
  }

  private assertEditable(record: MedicalRecord): void {
    if (record.status === MedicalRecordStatus.COMPLETED) {
      throw new ConflictException(
        'Hồ sơ bệnh án đã hoàn tất nên không thể chỉnh sửa (BR-08). ' +
          'Mọi thay đổi sau khi hoàn tất phải đi qua đường sửa có ghi nhật ký kiểm toán.',
      );
    }
  }

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

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function assertDateOrder(startDate: string, endDate: string | null): void {
  if (endDate && endDate < startDate) {
    throw new BadRequestException('Ngày kết thúc điều trị không được trước ngày bắt đầu.');
  }
}
