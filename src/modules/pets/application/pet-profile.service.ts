import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
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

/** Mot phieu kham - khoi "Medical History". */
export interface PetMedicalHistoryRow {
  examinationId: string;
  appointmentId: string;
  examinedAt: Date;
  doctorName: string | null;
  branchName: string | null;
  diagnosisText: string | null;
  diseaseGroups: string[];
  notes: string | null;
  temperatureCelsius: number | null;
  weightKg: number | null;
}

/** Mot don thuoc kem cac dong thuoc - khoi "Prescription". */
export interface PetPrescriptionRow {
  prescriptionId: string;
  examinationId: string;
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
  examinationId: string;
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
    @InjectRepository(Examination) private readonly examinationsRepository: Repository<Examination>,
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

    const rows = await this.examinationsRepository
      .createQueryBuilder('examination')
      .innerJoin('examination.appointment', 'appointment')
      .leftJoin('examination.doctor', 'doctor')
      .leftJoin('appointment.branch', 'branch')
      .select('examination.id', 'examination_id')
      .addSelect('appointment.id', 'appointment_id')
      .addSelect('examination.examined_at', 'examined_at')
      .addSelect('examination.diagnosis_text', 'diagnosis_text')
      .addSelect('examination.disease_groups', 'disease_groups')
      .addSelect('examination.notes', 'notes')
      .addSelect('examination.temperature_celsius', 'temperature_celsius')
      .addSelect('examination.weight_kg', 'weight_kg')
      .addSelect('doctor.full_name', 'doctor_name')
      .addSelect('branch.branch_name', 'branch_name')
      .where('appointment.petId = :petId', { petId })
      .orderBy('examination.examined_at', 'DESC')
      .getRawMany<RawPetMedicalHistoryRow>();

    return rows.map((row) => ({
      examinationId: row.examination_id,
      appointmentId: row.appointment_id,
      examinedAt: new Date(row.examined_at),
      doctorName: row.doctor_name,
      branchName: row.branch_name,
      diagnosisText: row.diagnosis_text,
      diseaseGroups: row.disease_groups ?? [],
      notes: row.notes,
      temperatureCelsius: row.temperature_celsius === null ? null : Number(row.temperature_celsius),
      weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    }));
  }

  async findPrescriptions(petId: string): Promise<PetPrescriptionRow[]> {
    await this.assertPetExists(petId);

    const prescriptions = await this.prescriptionsRepository
      .createQueryBuilder('prescription')
      .innerJoinAndSelect('prescription.examination', 'examination')
      .innerJoin('examination.appointment', 'appointment')
      .leftJoinAndSelect('examination.doctor', 'doctor')
      .leftJoinAndSelect('prescription.items', 'item')
      // `PrescriptionItem.medication` va `Medication.item` khai bao `eager: true`, nhung
      // QueryBuilder KHONG tu nap quan he eager (chi `repository.find()` moi lam) - phai
      // join tay, neu khong ten thuoc se rong.
      .leftJoinAndSelect('item.medication', 'medication')
      .leftJoinAndSelect('medication.item', 'medicationItem')
      .where('appointment.petId = :petId', { petId })
      .orderBy('examination.examined_at', 'DESC')
      .getMany();

    return prescriptions.map((prescription) => ({
      prescriptionId: prescription.id,
      examinationId: prescription.examinationId,
      examinedAt: prescription.examination.examinedAt,
      doctorName: prescription.examination.doctor?.fullName ?? null,
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
      .innerJoinAndSelect('labTest.examination', 'examination')
      .innerJoin('examination.appointment', 'appointment')
      .where('appointment.petId = :petId', { petId })
      .orderBy('labTest.created_at', 'DESC')
      .getMany();

    return orders.map((order) => ({
      labTestId: order.id,
      examinationId: order.examinationId,
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
  examination_id: string;
  appointment_id: string;
  examined_at: string;
  diagnosis_text: string | null;
  disease_groups: string[] | null;
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
