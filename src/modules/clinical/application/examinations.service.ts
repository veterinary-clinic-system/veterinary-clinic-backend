import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { PrescriptionItem } from '@/modules/clinical/domain/entities/prescription-item.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
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
  'prescriptions',
  'prescriptions.items',
  'prescriptions.items.medication',
  'prescriptions.items.medication.item',
  'labTestOrders',
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
  ) {}

  /**
   * Section 4.1.4 exam-entry form. Creating the Examination also flips the parent
   * Appointment to COMPLETED (both writes happen in one transaction) - the doctor
   * finishing the write-up is what marks the visit itself as done.
   */
  async create(dto: CreateExaminationDto, actor: AuthenticatedUser): Promise<Examination> {
    const doctor = await this.doctorsRepository.findOne({ where: { userId: actor.userId } });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found for the current user');
    }

    const appointment = await this.appointmentsRepository.findOne({
      where: { id: dto.appointmentId },
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const existing = await this.examinationsRepository.findOne({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing) {
      throw new ConflictException(
        'An examination already exists for this appointment - use PATCH to edit it',
      );
    }

    const created = await this.dataSource.transaction(async (manager) => {
      const entity = manager.create(Examination, {
        appointmentId: dto.appointmentId,
        doctorId: doctor.id,
        diseaseGroups: dto.diseaseGroups ?? [],
        diagnosisText: dto.diagnosisText ?? null,
        notes: dto.notes ?? null,
        temperatureCelsius: dto.temperatureCelsius ?? null,
        weightKg: dto.weightKg ?? null,
        heartRateBpm: dto.heartRateBpm ?? null,
        respiratoryRateBpm: dto.respiratoryRateBpm ?? null,
        attachmentUrls: dto.attachmentUrls ?? [],
      });
      const saved = await manager.save(entity);
      await manager.update(Appointment, appointment.id, { status: AppointmentStatus.COMPLETED });
      return saved;
    });

    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateExaminationDto): Promise<Examination> {
    await this.assertExists(id);

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

  /** Section 4.1.4: "Prescribe medication: dosage, number of days" - one submit = one Prescription. */
  async createPrescription(
    examinationId: string,
    dto: CreatePrescriptionDto,
  ): Promise<Prescription> {
    await this.assertExists(examinationId);

    const medicationIds = [...new Set(dto.items.map((item) => item.medicationId))];
    const medications = await this.medicationsRepository.find({ where: { id: In(medicationIds) } });
    if (medications.length !== medicationIds.length) {
      const foundIds = new Set(medications.map((m) => m.id));
      const missing = medicationIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Medication(s) not found: ${missing.join(', ')}`);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      // Prescription.items has { cascade: true } (see prescription.entity.ts) so saving
      // the Prescription with its `items` array populated inserts both in one go.
      const prescription = manager.create(Prescription, {
        examinationId,
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
      return manager.save(prescription);
    });

    return this.prescriptionsRepository.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.medication', 'items.medication.item'],
    }) as Promise<Prescription>;
  }

  async listPrescriptions(examinationId: string): Promise<Prescription[]> {
    await this.assertExists(examinationId);
    return this.prescriptionsRepository.find({
      where: { examinationId },
      relations: ['items', 'items.medication', 'items.medication.item'],
      order: { createdAt: 'ASC' },
    });
  }

  /** Section 4.1.4: "order lab tests" - result is filled in later via updateLabTest. */
  async createLabTest(examinationId: string, dto: CreateLabTestDto): Promise<LabTestOrder> {
    await this.assertExists(examinationId);
    const labTest = this.labTestOrdersRepository.create({
      examinationId,
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
}
