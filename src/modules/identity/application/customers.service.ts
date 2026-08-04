import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateCustomerDto } from '@/modules/identity/presentation/dto/create-customer.dto';
import { UpdateCustomerDto } from '@/modules/identity/presentation/dto/update-customer.dto';
import { QueryCustomersDto } from '@/modules/identity/presentation/dto/query-customers.dto';

const BCRYPT_ROUNDS = 12;

/** Cot duoc phep noi vao `ORDER BY customer.<col>` tu `?sortBy=` cua client. */
const CUSTOMER_SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt', 'fullName', 'phone', 'email']);

/** Mot dong trong bang tom tat danh sach khach hang. */
export interface CustomerListRow {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  address: string | null;
  note: string | null;
  active: boolean;
  createdAt: Date;
  petCount: number;
  lastVisitAt: Date | null;
}

/** Ho so chi tiet mot khach hang - them cac so lieu tong hop cua man hinh chi tiet. */
export interface CustomerDetail extends CustomerListRow {
  appointmentCount: number;
  completedAppointmentCount: number;
  invoiceCount: number;
  /** Tong tien DA THANH TOAN, don vi dong. Hoa don chua thanh toan khong tinh vao day. */
  totalPaid: number;
  /** Tong tien cua cac hoa don CHUA thanh toan, don vi dong. */
  totalUnpaid: number;
}

/** Mot dong trong lich su giao dich cua khach (mot hoa don = mot lan kham da lap hoa don). */
export interface CustomerTransactionRow {
  invoiceId: string;
  appointmentId: string;
  /** Thoi diem dien ra lan kham (`appointment.startAt`), khong phai luc lap hoa don. */
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
  /** Tong tien hoa don, don vi dong (SUM(price * quantity) tren cac dong hoa don). */
  totalAmount: number;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    // Doc-only sang bang cua module khac (dem thu cung, lich su giao dich) - dung
    // dung mot lop entity/repository, khong goi vao service cua chung. Cung cach
    // PetsModule/SchedulingModule dang lam.
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
  ) {}

  // ---------------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------------

  /**
   * Them khach hang moi tai quay. So dien thoai la dinh danh duy nhat cua khach nen
   * duoc kiem tra trung truoc - neu da ton tai thi le tan phai mo ho so cu len sua
   * chu khong tao ban ghi thu hai cho cung mot nguoi.
   */
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
        email: dto.email ?? null,
        // Khach chi den quay thi khong can mat khau - giong tai khoan duoc tu tao
        // trong luong dat lich (xem AppointmentsService.resolveOwner).
        passwordHash: dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : null,
        role: Role.PET_OWNER,
        branchId: null,
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
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    return this.findOne(id);
  }

  /**
   * "Xoa" khach hang = NGUNG HOAT DONG (`active = false`), khong bao gio xoa ban ghi.
   *
   * Ho so kham, hoa don va lich su giao dich cua khach deu tro nguoc ve `users.id`;
   * xoa cung se lam do vo toan bo lich su y te (rang buoc R6 - Phan V.4). Khach da
   * ngung hoat dong khong dang nhap duoc va khong nen duoc gan lich hen moi, nhung
   * du lieu cu van tra cuu duoc binh thuong. Co the kich hoat lai bat cu luc nao.
   *
   * Chan mot truong hop de gay hieu nham: khach van con lich hen SAP DIEN RA thi
   * phai huy/hoan tat cac lich do truoc, neu khong se co lich hen mo cua mot khach
   * "da ngung hoat dong" nam lai tren lich lam viec cua bac si.
   */
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

  // ---------------------------------------------------------------------------------
  // Tra cuu
  // ---------------------------------------------------------------------------------

  /**
   * Danh sach khach hang co tim kiem + loc. `petCount` va `lastVisitAt` duoc tinh
   * bang subquery tuong quan trong CUNG mot cau lenh thay vi N+1 truy van phu.
   */
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

    const money = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .innerJoin('invoice.appointment', 'appointment')
      .innerJoin('appointment.pet', 'pet')
      .leftJoin('invoice.items', 'item')
      .select('COUNT(DISTINCT invoice.id)', 'invoice_count')
      .addSelect(
        'COALESCE(SUM(item.price * item.quantity) FILTER (WHERE invoice.paid), 0)',
        'total_paid',
      )
      .addSelect(
        'COALESCE(SUM(item.price * item.quantity) FILTER (WHERE NOT invoice.paid), 0)',
        'total_unpaid',
      )
      .where('pet.ownerId = :ownerId', { ownerId: id })
      .getRawOne<{ invoice_count: string; total_paid: string; total_unpaid: string }>();

    return {
      ...this.toListRow(row),
      appointmentCount: Number(stats?.appointment_count ?? 0),
      completedAppointmentCount: Number(stats?.completed_count ?? 0),
      invoiceCount: Number(money?.invoice_count ?? 0),
      totalPaid: Number(money?.total_paid ?? 0),
      totalUnpaid: Number(money?.total_unpaid ?? 0),
    };
  }

  /** Danh sach thu cung cua khach hang (Section 4.1.1 - "xem danh sach thu cung"). */
  async findPets(id: string): Promise<Pet[]> {
    await this.findCustomerEntity(id);
    return this.petsRepository.find({
      where: { ownerId: id },
      relations: ['breed', 'breed.species'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lich su giao dich: moi hoa don da lap cho bat ky thu cung nao cua khach, moi nhat
   * truoc. Tong tien lay tu SUM cac dong hoa don (anh chup gia luc lap hoa don) chu
   * khong JOIN sang bang gia hien tai - hoa don la chung tu bat bien (Phan V.4 #4).
   */
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

  // ---------------------------------------------------------------------------------
  // Helper rieng
  // ---------------------------------------------------------------------------------

  /** 404 neu id khong ton tai HOAC ton tai nhung khong phai khach hang (vd tai khoan bac si). */
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
            .orWhere('customer.email ILIKE :search', { search: `%${search}%` });
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
      // Dau mut phai la HET NGAY do: '2026-08-04' phai bao gom ca luc 23:59.
      qb.andWhere("customer.createdAt < (CAST(:createdTo AS date) + INTERVAL '1 day')", {
        createdTo: query.createdTo,
      });
    }

    return qb;
  }

  /**
   * Bo cot chung cua ca danh sach lan chi tiet. `pet_count`/`last_visit_at` la subquery
   * tuong quan - mot cau lenh duy nhat, khong N+1.
   */
  private selectListColumns(qb: ReturnType<CustomersService['buildBaseQuery']>) {
    return qb
      .select('customer.id', 'id')
      .addSelect('customer.phone', 'phone')
      .addSelect('customer.full_name', 'full_name')
      .addSelect('customer.email', 'email')
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
      );
  }

  private toListRow(row: RawCustomerRow): CustomerListRow {
    return {
      id: row.id,
      phone: row.phone,
      fullName: row.full_name,
      email: row.email,
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
  phone: string;
  full_name: string;
  email: string | null;
  address: string | null;
  note: string | null;
  active: boolean;
  created_at: string;
  pet_count: string;
  last_visit_at: string | null;
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
