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

export interface MedicalHistoryDiagnosis {
  id: string;
  diagnosisText: string;
  severity: DiagnosisSeverity;
  isPrimary: boolean;
  diseaseName: string | null;
}

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

export interface PetLabTestRow {
  labTestId: string;
  medicalRecordId: string;
  orderedAt: Date;
  testName: string;
  status: LabTestStatus;
  resultText: string | null;
  resultFileUrls: string[];
}

export interface PetInvoiceRow {
  invoiceId: string;
  appointmentId: string;
  visitedAt: Date;
  paid: boolean;
  paidAt: Date | null;
  paymentMethod: PaymentMethod | null;
  totalAmount: number;
}

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

    const prescriptions = await this.prescriptionsRepository
      .createQueryBuilder('prescription')
      .innerJoinAndSelect('prescription.medicalRecord', 'medicalRecord')
      .leftJoinAndSelect('medicalRecord.doctor', 'doctor')

      .leftJoinAndSelect('medicalRecord.examination', 'examination')
      .leftJoinAndSelect('prescription.items', 'item')

      .leftJoinAndSelect('item.medication', 'medication')
      .leftJoinAndSelect('medication.item', 'medicationItem')
      .where('medicalRecord.pet_id = :petId', { petId })
      .orderBy('medicalRecord.created_at', 'DESC')
      .getMany();

    return prescriptions.map((prescription) => ({
      prescriptionId: prescription.id,
      medicalRecordId: prescription.medicalRecordId,
      
      examinedAt: prescription.medicalRecord.examination?.examinedAt ?? prescription.createdAt,
      doctorName: prescription.medicalRecord.doctor?.fullName ?? null,
      notes: prescription.notes,
      items: (prescription.items ?? []).map((item) => ({
        id: item.id,
        
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
