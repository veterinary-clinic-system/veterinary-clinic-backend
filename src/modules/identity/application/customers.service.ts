import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import {
  DiagnosisSeverity,
  MedicalRecordStatus,
} from '@/shared/common/enums/medical-record-status.enum';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateCustomerDto } from '@/modules/identity/presentation/dto/create-customer.dto';
import { UpdateCustomerDto } from '@/modules/identity/presentation/dto/update-customer.dto';
import { QueryCustomersDto } from '@/modules/identity/presentation/dto/query-customers.dto';

const BCRYPT_ROUNDS = 12;

const CUSTOMER_SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt', 'fullName', 'phone', 'email']);

export interface CustomerListRow {
  id: string;
  
  customerCode: string | null;
  phone: string;
  fullName: string;
  avatarUrl: string;
  email: string | null;
  dateOfBirth: string | null;
  address: string | null;
  note: string | null;
  active: boolean;
  createdAt: Date;
  petCount: number;
  lastVisitAt: Date | null;
}

export interface CustomerDetail extends CustomerListRow {
  appointmentCount: number;
  completedAppointmentCount: number;
  
  invoiceCount: number;
  
  purchaseCount: number;
  
  totalPaid: number;
  
  totalUnpaid: number;
}

export interface CustomerPurchaseRow {
  invoiceId: string;
  invoiceCode: string;
  
  purchasedAt: Date;
  branchName: string | null;
  status: InvoiceStatus;
  
  itemSummary: string;
  itemCount: number;
  totalAmount: number;
  paidAt: Date | null;
  paymentMethod: PaymentMethod | null;
}

export interface CustomerAppointmentRow {
  appointmentId: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priorityColor: PriorityColor | null;
  petId: string;
  petName: string;
  doctorName: string | null;
  branchName: string | null;
  serviceName: string | null;
}

export interface CustomerMedicalHistoryRow {
  medicalRecordId: string;
  appointmentId: string;
  status: MedicalRecordStatus;
  examinedAt: Date;
  petId: string;
  petName: string;
  doctorName: string | null;
  branchName: string | null;
  visitReason: string | null;
  diagnoses: CustomerMedicalHistoryDiagnosis[];
}

export interface CustomerMedicalHistoryDiagnosis {
  id: string;
  diagnosisText: string;
  severity: DiagnosisSeverity;
  isPrimary: boolean;
  diseaseName: string | null;
}

export interface CustomerTransactionRow {
  invoiceId: string;
  appointmentId: string;
  
  visitedAt: Date;
  petId: string;
  petName: string;
  doctorName: string | null;
  branchName: string | null;
  serviceName: string | null;
  appointmentStatus: AppointmentStatus;
  paid: boolean;
  paidAt: Date | null;
  paymentMethod: PaymentMethod | null;
  
  totalAmount: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,

    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordsRepository: Repository<MedicalRecord>,
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
  ) {}

  async create(dto: CreateCustomerDto): Promise<CustomerDetail> {
    const existingPhone = await this.usersRepository.findOne({ where: { phone: dto.phone } });
    if (existingPhone) {
      throw new ConflictException('So dien thoai nay da duoc su dung');
    }
    if (dto.email) {
      const existingEmail = await this.usersRepository.findOne({ where: { email: dto.email } });
      if (existingEmail) {
        throw new ConflictException('Email nay da duoc su dung');
      }
    }

    const customer = await this.usersRepository.save(
      this.usersRepository.create({
        phone: dto.phone,
        fullName: dto.fullName,
        avatarUrl: dto.avatarUrl ?? '/images/default-user.svg',
        email: dto.email ?? null,

        passwordHash: dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : null,
        role: Role.PET_OWNER,
        branchId: null,
        dateOfBirth: dto.dateOfBirth ?? null,
        address: dto.address ?? null,
        note: dto.note ?? null,
      }),
    );

    return this.findOne(customer.id);
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerDetail> {
    const customer = await this.findCustomerEntity(id);

    if (dto.email !== undefined && dto.email !== customer.email) {
      const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email nay da duoc su dung');
      }
    }

    await this.usersRepository.update(id, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    return this.findOne(id);
  }

  async deactivate(id: string): Promise<CustomerDetail> {
    const customer = await this.findCustomerEntity(id);
    if (!customer.active) {
      return this.findOne(id);
    }

    const upcoming = await this.appointmentsRepository
      .createQueryBuilder('appointment')
      .innerJoin('appointment.pet', 'pet')
      .where('pet.ownerId = :ownerId', { ownerId: id })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.IN_PROGRESS,
        ],
      })
      .getCount();

    if (upcoming > 0) {
      throw new ConflictException(
        `Khach hang con ${upcoming} lich hen chua ket thuc - vui long huy hoac hoan tat cac lich hen do truoc khi ngung hoat dong.`,
      );
    }

    await this.usersRepository.update(id, { active: false });
    return this.findOne(id);
  }

  async activate(id: string): Promise<CustomerDetail> {
    await this.findCustomerEntity(id);
    await this.usersRepository.update(id, { active: true });
    return this.findOne(id);
  }

  async findAll(query: QueryCustomersDto): Promise<PaginatedResultDto<CustomerListRow>> {
    const qb = this.buildBaseQuery(query);

    const total = await qb.getCount();

    const sortBy =
      query.sortBy && CUSTOMER_SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';

    const rows = await this.selectListColumns(qb)
      .orderBy(`customer.${sortBy}`, query.sortOrder ?? 'DESC')
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawMany<RawCustomerRow>();

    return new PaginatedResultDto(
      rows.map((row) => this.toListRow(row)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(id: string): Promise<CustomerDetail> {
    await this.findCustomerEntity(id);

    const row = await this.selectListColumns(
      this.usersRepository
        .createQueryBuilder('customer')
        .where('customer.role = :role', { role: Role.PET_OWNER })
        .andWhere('customer.id = :id', { id }),
    ).getRawOne<RawCustomerRow>();

    if (!row) {
      throw new NotFoundException('Khong tim thay khach hang');
    }

    const stats = await this.appointmentsRepository
      .createQueryBuilder('appointment')
      .innerJoin('appointment.pet', 'pet')
      .select('COUNT(*)', 'appointment_count')
      .addSelect(
        `COUNT(*) FILTER (WHERE appointment.status = '${AppointmentStatus.COMPLETED}')`,
        'completed_count',
      )
      .where('pet.ownerId = :ownerId', { ownerId: id })
      .getRawOne<{ appointment_count: string; completed_count: string }>();

    const money = await this.moneyStatsOf(id);

    return {
      ...this.toListRow(row),
      appointmentCount: Number(stats?.appointment_count ?? 0),
      completedAppointmentCount: Number(stats?.completed_count ?? 0),
      ...money,
    };
  }

  private async moneyStatsOf(customerId: string): Promise<{
    invoiceCount: number;
    purchaseCount: number;
    totalPaid: number;
    totalUnpaid: number;
  }> {
    const [billed] = await this.invoicesRepository.query(
      `
      SELECT COUNT(*) FILTER (WHERE "source" = 'CLINIC')                       AS "clinic_count",
             COUNT(*) FILTER (WHERE "source" = 'POS')                          AS "pos_count",
             COALESCE(SUM("total_amount") FILTER (
               WHERE "status" NOT IN ('CANCELLED', 'REFUNDED')
             ), 0)                                                             AS "total_billed"
      FROM "invoices"
      WHERE "customer_id" = $1 AND "deleted_at" IS NULL
      `,
      [customerId],
    );

    const [received] = await this.invoicesRepository.query(
      `
      SELECT COALESCE(SUM(payment."amount"), 0) AS "total_paid"
      FROM "payments" payment
      JOIN "invoices" invoice ON invoice."id" = payment."invoice_id"
      WHERE invoice."customer_id" = $1
        AND invoice."deleted_at" IS NULL
        AND payment."deleted_at" IS NULL
        AND payment."status" IN ('SUCCESS', 'REFUNDED')
      `,
      [customerId],
    );

    const totalPaid = Number(received?.total_paid ?? 0);
    const totalBilled = Number(billed?.total_billed ?? 0);

    return {
      invoiceCount: Number(billed?.clinic_count ?? 0),
      purchaseCount: Number(billed?.pos_count ?? 0),
      totalPaid,
      totalUnpaid: Math.max(0, totalBilled - totalPaid),
    };
  }

  async findPets(id: string): Promise<Pet[]> {
    await this.findCustomerEntity(id);
    return this.petsRepository.find({
      where: { ownerId: id },
      relations: ['breed', 'breed.species'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAppointments(id: string): Promise<CustomerAppointmentRow[]> {
    await this.findCustomerEntity(id);

    const rows = await this.appointmentsRepository
      .createQueryBuilder('appointment')
      .innerJoin('appointment.pet', 'pet')
      .leftJoin('appointment.doctor', 'doctor')
      .leftJoin('appointment.branch', 'branch')
      .leftJoin('appointment.service', 'service')
      .leftJoin('service.item', 'serviceItem')
      .select('appointment.id', 'appointment_id')
      .addSelect('appointment.start_at', 'start_at')
      .addSelect('appointment.end_at', 'end_at')
      .addSelect('appointment.status', 'status')
      .addSelect('appointment.priority_color', 'priority_color')
      .addSelect('pet.id', 'pet_id')
      .addSelect('pet.name', 'pet_name')
      .addSelect('doctor.full_name', 'doctor_name')
      .addSelect('branch.branch_name', 'branch_name')
      .addSelect('serviceItem.item_name', 'service_name')
      .where('pet.ownerId = :ownerId', { ownerId: id })
      .orderBy('appointment.start_at', 'DESC')
      .getRawMany<RawCustomerAppointmentRow>();

    return rows.map((row) => ({
      appointmentId: row.appointment_id,
      startAt: new Date(row.start_at),
      endAt: new Date(row.end_at),
      status: row.status,
      priorityColor: row.priority_color,
      petId: row.pet_id,
      petName: row.pet_name,
      doctorName: row.doctor_name,
      branchName: row.branch_name,
      serviceName: row.service_name,
    }));
  }

  async findMedicalHistory(id: string): Promise<CustomerMedicalHistoryRow[]> {
    await this.findCustomerEntity(id);

    const rows = await this.medicalRecordsRepository
      .createQueryBuilder('medicalRecord')
      .innerJoin('medicalRecord.appointment', 'appointment')
      .innerJoin('medicalRecord.pet', 'pet')
      .leftJoin('medicalRecord.doctor', 'doctor')
      
      .leftJoin('medicalRecord.examination', 'examination')
      .leftJoin('appointment.branch', 'branch')
      .select('medicalRecord.id', 'medical_record_id')
      .addSelect('appointment.id', 'appointment_id')
      .addSelect('medicalRecord.status', 'status')
      .addSelect('COALESCE(examination.examined_at, medicalRecord.created_at)', 'examined_at')
      .addSelect('medicalRecord.visit_reason', 'visit_reason')
      .addSelect('pet.id', 'pet_id')
      .addSelect('pet.name', 'pet_name')
      .addSelect('doctor.full_name', 'doctor_name')
      .addSelect('branch.branch_name', 'branch_name')
      .addSelect(CUSTOMER_DIAGNOSES_JSON_SUBQUERY, 'diagnoses')
      .where('pet.ownerId = :ownerId', { ownerId: id })
      .orderBy('COALESCE(examination.examined_at, medicalRecord.created_at)', 'DESC')
      .getRawMany<RawCustomerMedicalHistoryRow>();

    return rows.map((row) => ({
      medicalRecordId: row.medical_record_id,
      appointmentId: row.appointment_id,
      status: row.status,
      examinedAt: new Date(row.examined_at),
      petId: row.pet_id,
      petName: row.pet_name,
      doctorName: row.doctor_name,
      branchName: row.branch_name,
      visitReason: row.visit_reason,
      diagnoses: row.diagnoses ?? [],
    }));
  }

  async findTransactions(id: string): Promise<CustomerTransactionRow[]> {
    await this.findCustomerEntity(id);

    const rows = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .innerJoin('invoice.appointment', 'appointment')
      .innerJoin('appointment.pet', 'pet')
      .leftJoin('appointment.doctor', 'doctor')
      .leftJoin('appointment.branch', 'branch')
      .leftJoin('appointment.service', 'service')
      .leftJoin('service.item', 'serviceItem')
      .leftJoin('invoice.items', 'invoiceItem')
      .select('invoice.id', 'invoice_id')
      .addSelect('appointment.id', 'appointment_id')
      .addSelect('appointment.start_at', 'visited_at')
      .addSelect('appointment.status', 'appointment_status')
      .addSelect('pet.id', 'pet_id')
      .addSelect('pet.name', 'pet_name')
      .addSelect('doctor.full_name', 'doctor_name')
      .addSelect('branch.branch_name', 'branch_name')
      .addSelect('serviceItem.item_name', 'service_name')
      .addSelect('invoice.paid', 'paid')
      .addSelect('invoice.paid_at', 'paid_at')
      .addSelect('invoice.payment_method', 'payment_method')
      .addSelect('COALESCE(SUM(invoiceItem.price * invoiceItem.quantity), 0)', 'total_amount')
      .where('pet.ownerId = :ownerId', { ownerId: id })
      .groupBy('invoice.id')
      .addGroupBy('appointment.id')
      .addGroupBy('pet.id')
      .addGroupBy('doctor.id')
      .addGroupBy('branch.id')
      .addGroupBy('serviceItem.id')
      .orderBy('appointment.start_at', 'DESC')
      .getRawMany<RawTransactionRow>();

    return rows.map((row) => ({
      invoiceId: row.invoice_id,
      appointmentId: row.appointment_id,
      visitedAt: new Date(row.visited_at),
      petId: row.pet_id,
      petName: row.pet_name,
      doctorName: row.doctor_name,
      branchName: row.branch_name,
      serviceName: row.service_name,
      appointmentStatus: row.appointment_status,
      paid: row.paid,
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
      paymentMethod: row.payment_method,
      totalAmount: Number(row.total_amount),
    }));
  }

  async findPurchases(id: string): Promise<CustomerPurchaseRow[]> {
    await this.findCustomerEntity(id);

    const rows: RawPurchaseRow[] = await this.invoicesRepository.query(
      `
      SELECT invoice."id"                AS "invoice_id",
             invoice."invoice_code"      AS "invoice_code",
             invoice."created_at"        AS "purchased_at",
             invoice."status"            AS "status",
             invoice."total_amount"      AS "total_amount",
             invoice."paid_at"           AS "paid_at",
             invoice."payment_method"    AS "payment_method",
             branch."branch_name"        AS "branch_name",
             COALESCE(COUNT(line."id"), 0) AS "item_count",
             COALESCE(
               STRING_AGG(item."item_name" || ' x' || line."quantity", ', '
                          ORDER BY item."item_name"),
               ''
             )                           AS "item_summary"
      FROM "invoices" invoice
      LEFT JOIN "branches" branch ON branch."id" = invoice."branch_id"
      LEFT JOIN "invoice_items" line
             ON line."invoice_id" = invoice."id" AND line."deleted_at" IS NULL
      LEFT JOIN "items" item ON item."id" = line."item_id"
      WHERE invoice."customer_id" = $1
        AND invoice."source" = 'POS'
        AND invoice."deleted_at" IS NULL
      GROUP BY invoice."id", branch."branch_name"
      ORDER BY invoice."created_at" DESC
      `,
      [id],
    );

    return rows.map((row) => ({
      invoiceId: row.invoice_id,
      invoiceCode: row.invoice_code,
      purchasedAt: new Date(row.purchased_at),
      branchName: row.branch_name,
      status: row.status,
      itemSummary: row.item_summary,
      itemCount: Number(row.item_count),
      totalAmount: Number(row.total_amount),
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
      paymentMethod: row.payment_method,
    }));
  }

  private async findCustomerEntity(id: string): Promise<User> {
    const customer = await this.usersRepository.findOne({
      where: { id, role: Role.PET_OWNER },
    });
    if (!customer) {
      throw new NotFoundException('Khong tim thay khach hang');
    }
    return customer;
  }

  private buildBaseQuery(query: QueryCustomersDto) {
    const qb = this.usersRepository
      .createQueryBuilder('customer')
      .where('customer.role = :role', { role: Role.PET_OWNER });

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('customer.fullName ILIKE :search', { search: `%${search}%` })
            .orWhere('customer.phone ILIKE :search', { search: `%${search}%` })
            .orWhere('customer.email ILIKE :search', { search: `%${search}%` })
            
            .orWhere('customer.customerCode ILIKE :search', { search: `%${search}%` });
        }),
      );
    }

    if (query.active !== undefined) {
      qb.andWhere('customer.active = :active', { active: query.active });
    }

    if (query.hasPets !== undefined) {
      const existsPet = `EXISTS (SELECT 1 FROM pets p WHERE p.owner_id = customer.id AND p.deleted_at IS NULL)`;
      qb.andWhere(query.hasPets ? existsPet : `NOT ${existsPet}`);
    }

    if (query.branchId) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM appointments a
           JOIN pets p ON p.id = a.pet_id
           WHERE p.owner_id = customer.id
             AND a.branch_id = :branchId
             AND a.deleted_at IS NULL
             AND p.deleted_at IS NULL
         )`,
        { branchId: query.branchId },
      );
    }

    if (query.createdFrom) {
      qb.andWhere('customer.createdAt >= :createdFrom', { createdFrom: query.createdFrom });
    }
    if (query.createdTo) {
      
      qb.andWhere("customer.createdAt < (CAST(:createdTo AS date) + INTERVAL '1 day')", {
        createdTo: query.createdTo,
      });
    }

    return qb;
  }

  private selectListColumns(qb: ReturnType<CustomersService['buildBaseQuery']>) {
    return (
      qb
        .select('customer.id', 'id')
        .addSelect('customer.customer_code', 'customer_code')
        .addSelect('customer.phone', 'phone')
        .addSelect('customer.full_name', 'full_name')
        .addSelect('customer.avatar_url', 'avatar_url')
        .addSelect('customer.email', 'email')

        .addSelect("TO_CHAR(customer.date_of_birth, 'YYYY-MM-DD')", 'date_of_birth')
        .addSelect('customer.address', 'address')
        .addSelect('customer.note', 'note')
        .addSelect('customer.active', 'active')
        .addSelect('customer.created_at', 'created_at')
        .addSelect(
          `(SELECT COUNT(*) FROM pets p WHERE p.owner_id = customer.id AND p.deleted_at IS NULL)`,
          'pet_count',
        )
        .addSelect(
          `(SELECT MAX(a.start_at)
            FROM appointments a
            JOIN pets p ON p.id = a.pet_id
           WHERE p.owner_id = customer.id
             AND a.status = '${AppointmentStatus.COMPLETED}'
             AND a.deleted_at IS NULL
             AND p.deleted_at IS NULL)`,
          'last_visit_at',
        )
    );
  }

  private toListRow(row: RawCustomerRow): CustomerListRow {
    return {
      id: row.id,
      customerCode: row.customer_code,
      phone: row.phone,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      dateOfBirth: row.date_of_birth,
      address: row.address,
      note: row.note,
      active: row.active,
      createdAt: new Date(row.created_at),
      petCount: Number(row.pet_count),
      lastVisitAt: row.last_visit_at ? new Date(row.last_visit_at) : null,
    };
  }
}

interface RawCustomerRow {
  id: string;
  customer_code: string | null;
  phone: string;
  full_name: string;
  avatar_url: string;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
  pet_count: string;
  last_visit_at: string | null;
}

interface RawCustomerAppointmentRow {
  appointment_id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  priority_color: PriorityColor | null;
  pet_id: string;
  pet_name: string;
  doctor_name: string | null;
  branch_name: string | null;
  service_name: string | null;
}

interface RawCustomerMedicalHistoryRow {
  medical_record_id: string;
  appointment_id: string;
  status: MedicalRecordStatus;
  examined_at: string;
  visit_reason: string | null;
  diagnoses: CustomerMedicalHistoryDiagnosis[] | null;
  pet_id: string;
  pet_name: string;
  doctor_name: string | null;
  branch_name: string | null;
}

const CUSTOMER_DIAGNOSES_JSON_SUBQUERY = `(
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

interface RawPurchaseRow {
  invoice_id: string;
  invoice_code: string;
  purchased_at: string;
  status: InvoiceStatus;
  total_amount: string;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  branch_name: string | null;
  item_count: string;
  item_summary: string;
}

interface RawTransactionRow {
  invoice_id: string;
  appointment_id: string;
  visited_at: string;
  appointment_status: AppointmentStatus;
  pet_id: string;
  pet_name: string;
  doctor_name: string | null;
  branch_name: string | null;
  service_name: string | null;
  paid: boolean;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  total_amount: string;
}
