import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import {
  DiagnosisSeverity,
  MedicalRecordStatus,
} from '@/shared/common/enums/medical-record-status.enum';
import { LabTestStatus } from '@/shared/common/enums/lab-test-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';

/** Mot lich hen cua thu cung - khoi "Appointment" cua ho so (FR-04-03). */
export interface PetAppointmentRow {
  appointmentId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priorityColor: PriorityColor | null;
  doctorName: string | null;
  branchName: string | null;
  serviceName: string | null;
}

/** Mot chan doan rut gon, nhung trong benh su - xem `DIAGNOSES_JSON_SUBQUERY`. */
export interface MedicalHistoryDiagnosis {
  id: string;
  diagnosisText: string;
  severity: DiagnosisSeverity;
  isPrimary: boolean;
  diseaseName: string | null;
}

/** Mot ho so benh an - khoi "Medical History". */
export interface PetMedicalHistoryRow {
  medicalRecordId: string;
  appointmentId: string;
  status: MedicalRecordStatus;
  examinedAt: Date;
  doctorName: string | null;
  branchName: string | null;
  visitReason: string | null;
  diagnoses: MedicalHistoryDiagnosis[];
  notes: string | null;
  temperatureCelsius: number | null;
  weightKg: number | null;
}

/**
 * Cac chan doan cua mot ho so, gom san thanh mang JSON trong CSDL.
 *
 * `json_agg` tra ve `NULL` (khong phai `[]`) khi khong co hang nao - da boc
 * `COALESCE` de tang goi luon nhan duoc mot mang. Sap xep theo `is_primary DESC` de
 * chan doan chinh luon dung dau, giao dien khong phai tu tim.
 */
const DIAGNOSES_JSON_SUBQUERY = `(
  SELECT COALESCE(
           json_agg(
             json_build_object(
               'id',            diag."id",
               'diagnosisText', diag."diagnosis_text",
               'severity',      diag."severity",
               'isPrimary',     diag."is_primary",
               'diseaseName',   dis."disease_name"
             )
             ORDER BY diag."is_primary" DESC, diag."created_at" ASC
           ),
           '[]'::json
         )
    FROM "diagnoses" diag
    LEFT JOIN "diseases" dis ON dis."id" = diag."disease_id"
   WHERE diag."medical_record_id" = "medicalRecord"."id"
     AND diag."deleted_at" IS NULL
)`;

/** Mot don thuoc kem cac dong thuoc - khoi "Prescription". */
export interface PetPrescriptionRow {
  prescriptionId: string;
  medicalRecordId: string;
  examinedAt: Date;
  doctorName: string | null;
  notes: string | null;
  items: {
    id: string;
    medicationName: string;
    unit: string;
    dosage: string;
    durationDays: number;
    instructions: string | null;
  }[];
}

/** Mot chi dinh xet nghiem - khoi "Laboratory". */
export interface PetLabTestRow {
  labTestId: string;
  medicalRecordId: string;
  orderedAt: Date;
  testName: string;
  status: LabTestStatus;
  resultText: string | null;
  resultFileUrls: string[];
}

/** Mot hoa don cua thu cung - khoi "Invoice". */
export interface PetInvoiceRow {
  invoiceId: string;
  appointmentId: string;
  visitedAt: Date;
  paid: boolean;
  paidAt: Date | null;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
}

/**
 * Cac khoi du lieu cua trang ho so thu cung (FR-04-03 / muc 12.4 SRS).
 *
 * Tach khoi `PetsService` co chu dich: `PetsService` la CRUD + tim kiem cua thu cung,
 * con day la cac truy van CHI DOC gom du lieu tu clinical/billing/scheduling de dung
 * mot trang. Gop chung se bien `PetsService` thanh noi chua moi thu.
 *
 * Moi truy van deu bat dau bang `assertPetExists` de mot id sai tra ve 404 thay vi mot
 * mang rong (rat de bi doc nham thanh "thu cung nay chua tung kham").
 *
 * Khoi "Vaccination" khong co o day: he thong chua co bang tiem chung (Phase 9). Giao
 * dien dung tab do voi trang thai rong va ghi chu phase, KHONG goi API gia.
 */
@Injectable()
export class PetProfileService {
  constructor(
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordsRepository: Repository<MedicalRecord>,
    @InjectRepository(Prescription)
    private readonly prescriptionsRepository: Repository<Prescription>,
    @InjectRepository(LabTestOrder) private readonly labTestsRepository: Repository<LabTestOrder>,
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
  ) {}

  async findAppointments(petId: string): Promise<PetAppointmentRow[]> {
    await this.assertPetExists(petId);

    const rows = await this.appointmentsRepository
      .createQueryBuilder('appointment')
      .leftJoin('appointment.doctor', 'doctor')
      .leftJoin('appointment.branch', 'branch')
      .leftJoin('appointment.service', 'service')
      .leftJoin('service.item', 'serviceItem')
      .select('appointment.id', 'appointment_id')
      .addSelect('appointment.start_at', 'start_at')
      .addSelect('appointment.end_at', 'end_at')
      .addSelect('appointment.status', 'status')
      .addSelect('appointment.priority_color', 'priority_color')
      .addSelect('doctor.full_name', 'doctor_name')
      .addSelect('branch.branch_name', 'branch_name')
      .addSelect('serviceItem.item_name', 'service_name')
      .where('appointment.petId = :petId', { petId })
      .orderBy('appointment.start_at', 'DESC')
      .getRawMany<RawPetAppointmentRow>();

    return rows.map((row) => ({
      appointmentId: row.appointment_id,
      startAt: new Date(row.start_at),
      endAt: new Date(row.end_at),
      status: row.status,
      priorityColor: row.priority_color,
      doctorName: row.doctor_name,
      branchName: row.branch_name,
      serviceName: row.service_name,
    }));
  }

  /**
   * Benh su cua thu cung. Tu P4-T8, moi dong la mot HO SO BENH AN (khong con la mot
   * phieu kham), va chan doan doc tu bang `diagnoses` chu khong tu
   * `examinations.disease_groups`.
   *
   * `diagnoses` duoc gom thanh mang JSON ngay trong SQL thay vi ban ra roi nap tung
   * ho so: mot con vat kham lau nam co hang chuc ho so, moi ho so vai chan doan - lam
   * theo kieu N+1 la vai chuc luot di ve CSDL cho mot lan mo tab.
   */
  async findMedicalHistory(petId: string): Promise<PetMedicalHistoryRow[]> {
    await this.assertPetExists(petId);

    const rows = await this.medicalRecordsRepository
      .createQueryBuilder('medicalRecord')
      .innerJoin('medicalRecord.appointment', 'appointment')
      .leftJoin('medicalRecord.doctor', 'doctor')
      .leftJoin('medicalRecord.examination', 'examination')
      .leftJoin('appointment.branch', 'branch')
      .select('medicalRecord.id', 'medical_record_id')
      .addSelect('appointment.id', 'appointment_id')
      .addSelect('medicalRecord.status', 'status')
      .addSelect('COALESCE(examination.examined_at, medicalRecord.created_at)', 'examined_at')
      .addSelect('medicalRecord.visit_reason', 'visit_reason')
      .addSelect('medicalRecord.notes', 'notes')
      .addSelect('examination.temperature_celsius', 'temperature_celsius')
      .addSelect('examination.weight_kg', 'weight_kg')
      .addSelect('doctor.full_name', 'doctor_name')
      .addSelect('branch.branch_name', 'branch_name')
      .addSelect(DIAGNOSES_JSON_SUBQUERY, 'diagnoses')
      .where('medicalRecord.pet_id = :petId', { petId })
      .orderBy('COALESCE(examination.examined_at, medicalRecord.created_at)', 'DESC')
      .getRawMany<RawPetMedicalHistoryRow>();

    return rows.map((row) => ({
      medicalRecordId: row.medical_record_id,
      appointmentId: row.appointment_id,
      status: row.status,
      examinedAt: new Date(row.examined_at),
      doctorName: row.doctor_name,
      branchName: row.branch_name,
      visitReason: row.visit_reason,
      diagnoses: row.diagnoses ?? [],
      notes: row.notes,
      temperatureCelsius: row.temperature_celsius === null ? null : Number(row.temperature_celsius),
      weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    }));
  }

  async findPrescriptions(petId: string): Promise<PetPrescriptionRow[]> {
    await this.assertPetExists(petId);

    // Loc thang tren `medicalRecord.pet_id` (cot denormalise) thay vi join nguoc qua
    // `appointments` - it hon mot bang trong ke hoach truy van.
    const prescriptions = await this.prescriptionsRepository
      .createQueryBuilder('prescription')
      .innerJoinAndSelect('prescription.medicalRecord', 'medicalRecord')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')
      // `leftJoin` chu khong `innerJoin`: mot ho so DRAFT co the da co don thuoc ma
      // chua ghi sinh hieu - `innerJoin` se lam don thuoc do bien mat khoi ho so.
      .leftJoinAndSelect('medicalRecord.examination', 'examination')
      .leftJoinAndSelect('prescription.items', 'item')
      // `PrescriptionItem.medication` va `Medication.item` khai bao `eager: true`, nhung
      // QueryBuilder KHONG tu nap quan he eager (chi `repository.find()` moi lam) - phai
      // join tay, neu khong ten thuoc se rong.
      .leftJoinAndSelect('item.medication', 'medication')
      .leftJoinAndSelect('medication.item', 'medicationItem')
      .where('medicalRecord.pet_id = :petId', { petId })
      .orderBy('medicalRecord.created_at', 'DESC')
      .getMany();

    return prescriptions.map((prescription) => ({
      prescriptionId: prescription.id,
      medicalRecordId: prescription.medicalRecordId,
      // Ho so chua ghi sinh hieu thi chua co `examinedAt` - lay ngay mo ho so.
      examinedAt: prescription.medicalRecord.examination?.examinedAt ?? prescription.createdAt,
      doctorName: prescription.medicalRecord.doctor?.fullName ?? null,
      notes: prescription.notes,
      items: (prescription.items ?? []).map((item) => ({
        id: item.id,
        // `medication` va `medication.item` deu la quan he eager nen co san o day.
        medicationName: item.medication?.item?.itemName ?? '—',
        unit: item.medication?.unit ?? '',
        dosage: item.dosage,
        durationDays: item.durationDays,
        instructions: item.instructions,
      })),
    }));
  }

  async findLabTests(petId: string): Promise<PetLabTestRow[]> {
    await this.assertPetExists(petId);

    const orders = await this.labTestsRepository
      .createQueryBuilder('labTest')
      .innerJoin('labTest.medicalRecord', 'medicalRecord')
      .where('medicalRecord.pet_id = :petId', { petId })
      .orderBy('labTest.created_at', 'DESC')
      .getMany();

    return orders.map((order) => ({
      labTestId: order.id,
      medicalRecordId: order.medicalRecordId,
      orderedAt: order.createdAt,
      testName: order.testName,
      status: order.status,
      resultText: order.resultText,
      resultFileUrls: order.resultFileUrls,
    }));
  }

  /**
   * Tong tien lay tu SUM cac dong hoa don (anh chup gia luc lap hoa don) chu khong
   * JOIN sang bang gia hien tai - hoa don la chung tu bat bien (Phan V.4 #4).
   */
  async findInvoices(petId: string): Promise<PetInvoiceRow[]> {
    await this.assertPetExists(petId);

    const rows = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .innerJoin('invoice.appointment', 'appointment')
      .leftJoin('invoice.items', 'invoiceItem')
      .select('invoice.id', 'invoice_id')
      .addSelect('appointment.id', 'appointment_id')
      .addSelect('appointment.start_at', 'visited_at')
      .addSelect('invoice.paid', 'paid')
      .addSelect('invoice.paid_at', 'paid_at')
      .addSelect('invoice.payment_method', 'payment_method')
      .addSelect('COALESCE(SUM(invoiceItem.price * invoiceItem.quantity), 0)', 'total_amount')
      .where('appointment.petId = :petId', { petId })
      .groupBy('invoice.id')
      .addGroupBy('appointment.id')
      .orderBy('appointment.start_at', 'DESC')
      .getRawMany<RawPetInvoiceRow>();

    return rows.map((row) => ({
      invoiceId: row.invoice_id,
      appointmentId: row.appointment_id,
      visitedAt: new Date(row.visited_at),
      paid: row.paid,
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
      paymentMethod: row.payment_method,
      totalAmount: Number(row.total_amount),
    }));
  }

  private async assertPetExists(petId: string): Promise<void> {
    const exists = await this.petsRepository.exists({ where: { id: petId } });
    if (!exists) {
      throw new NotFoundException('Không tìm thấy thú cưng');
    }
  }
}

interface RawPetAppointmentRow {
  appointment_id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  priority_color: PriorityColor | null;
  doctor_name: string | null;
  branch_name: string | null;
  service_name: string | null;
}

interface RawPetMedicalHistoryRow {
  medical_record_id: string;
  appointment_id: string;
  status: MedicalRecordStatus;
  examined_at: string;
  visit_reason: string | null;
  diagnoses: MedicalHistoryDiagnosis[] | null;
  notes: string | null;
  temperature_celsius: string | null;
  weight_kg: string | null;
  doctor_name: string | null;
  branch_name: string | null;
}

interface RawPetInvoiceRow {
  invoice_id: string;
  appointment_id: string;
  visited_at: string;
  paid: boolean;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  total_amount: string;
}
