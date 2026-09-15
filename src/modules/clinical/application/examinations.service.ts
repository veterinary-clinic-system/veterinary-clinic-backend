import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecordStatus } from '@/shared/common/enums/medical-record-status.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MedicalRecordsService } from '@/modules/clinical/application/medical-records.service';
import {
  PrescriptionView,
  PrescriptionsService,
} from '@/modules/clinical/application/prescriptions.service';
import { CreateExaminationDto } from '@/modules/clinical/presentation/dto/create-examination.dto';
import { UpdateExaminationDto } from '@/modules/clinical/presentation/dto/update-examination.dto';
import { CreatePrescriptionDto } from '@/modules/clinical/presentation/dto/create-prescription.dto';
import { CreateLabTestDto } from '@/modules/clinical/presentation/dto/create-lab-test.dto';
import { UpdateLabTestDto } from '@/modules/clinical/presentation/dto/update-lab-test.dto';

const EXAMINATION_DETAIL_RELATIONS = [
  'appointment',
  'appointment.pet',
  'appointment.pet.owner',
  'appointment.pet.breed',
  'appointment.pet.breed.species',
  'appointment.doctor',
  'appointment.branch',
  'doctor',

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
    @InjectRepository(LabTestOrder)
    private readonly labTestOrdersRepository: Repository<LabTestOrder>,
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

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

  async createPrescription(
    examinationId: string,
    dto: CreatePrescriptionDto,
  ): Promise<PrescriptionView> {
    const examination = await this.loadOrThrow(examinationId);
    return this.prescriptionsService.create(this.requireMedicalRecordId(examination), dto);
  }

  async listPrescriptions(examinationId: string): Promise<Prescription[]> {
    const medicalRecordId = this.requireMedicalRecordId(await this.loadOrThrow(examinationId));
    return this.prescriptionsService.findByMedicalRecord(medicalRecordId);
  }

  async createLabTest(examinationId: string, dto: CreateLabTestDto): Promise<LabTestOrder> {
    const examination = await this.loadOrThrow(examinationId);
    const labTest = this.labTestOrdersRepository.create({
      medicalRecordId: this.requireMedicalRecordId(examination),
      testName: dto.testName,
    });
    return this.labTestOrdersRepository.save(labTest);
  }

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

  private requireMedicalRecordId(examination: Examination): string {
    if (!examination.medicalRecordId) {
      throw new ConflictException(
        'Phiếu khám này chưa gắn với hồ sơ bệnh án nào nên chưa thể kê đơn hay chỉ định xét nghiệm.',
      );
    }
    return examination.medicalRecordId;
  }

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
