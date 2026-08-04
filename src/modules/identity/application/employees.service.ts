import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee } from '@/modules/identity/domain/entities/employee.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import {
  EmployeeStatus,
  NON_WORKING_EMPLOYEE_STATUSES,
} from '@/shared/common/enums/employee-status.enum';
import { BRANCH_SCOPED_ROLES, Role } from '@/shared/common/enums/role.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateEmployeeDto } from '@/modules/identity/presentation/dto/create-employee.dto';
import { UpdateEmployeeDto } from '@/modules/identity/presentation/dto/update-employee.dto';
import { QueryEmployeesDto } from '@/modules/identity/presentation/dto/query-employees.dto';

const BCRYPT_ROUNDS = 12;

const EMPLOYEE_SORTABLE_COLUMNS = new Set([
  'createdAt',
  'updatedAt',
  'fullName',
  'employeeCode',
  'hireDate',
  'status',
]);

const EMPLOYEE_RELATIONS = ['user', 'branch'];

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Tao ho so nhan su, kem tuy chon tao tai khoan dang nhap trong CUNG transaction.
   *
   * Vi sao phai cung transaction: neu tao `User` xong roi loi khi tao `Employee`, he
   * thong se con lai mot tai khoan dang nhap duoc nhung khong thuoc ve nhan vien nao -
   * dung nghia la mot tai khoan mo coi khong ai quan ly.
   */
  async create(dto: CreateEmployeeDto): Promise<Employee> {
    if (dto.account) {
      const existingPhone = await this.usersRepository.findOne({ where: { phone: dto.phone } });
      if (existingPhone) {
        throw new ConflictException('Số điện thoại này đã được dùng cho một tài khoản khác');
      }
      if (dto.account.role === Role.PET_OWNER) {
        throw new BadRequestException('Không thể tạo tài khoản khách hàng cho hồ sơ nhân sự');
      }
      if (BRANCH_SCOPED_ROLES.includes(dto.account.role) && !dto.branchId) {
        throw new BadRequestException(`Vai trò ${dto.account.role} bắt buộc phải gán chi nhánh`);
      }
    }

    if (dto.branchId) {
      const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
      if (!branch) {
        throw new BadRequestException('Không tìm thấy chi nhánh');
      }
    }

    const status = dto.status ?? EmployeeStatus.PROBATION;

    const saved = await this.dataSource.transaction(async (manager) => {
      let userId: string | null = null;

      if (dto.account) {
        const user = await manager.save(
          manager.create(User, {
            phone: dto.phone,
            fullName: dto.fullName,
            email: dto.email ?? null,
            passwordHash: await bcrypt.hash(dto.account.password, BCRYPT_ROUNDS),
            role: dto.account.role,
            branchId: dto.account.role === Role.ADMIN ? null : (dto.branchId ?? null),
            // Nhan vien tao o trang thai dinh chi/nghi viec thi tai khoan khoa ngay.
            active: !NON_WORKING_EMPLOYEE_STATUSES.includes(status),
          }),
        );
        userId = user.id;
      }

      return manager.save(
        manager.create(Employee, {
          userId,
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email ?? null,
          address: dto.address ?? null,
          position: dto.position ?? null,
          branchId: dto.branchId ?? null,
          hireDate: dto.hireDate ?? null,
          status,
          note: dto.note ?? null,
        }),
      );
    });

    return this.findOne(saved.id);
  }

  /**
   * Cap nhat ho so. Doi `status` sang SUSPENDED/RESIGNED se KHOA tai khoan dang nhap
   * lien ket trong cung transaction - day la ly do chinh de hai khai niem nay noi voi
   * nhau: cho nghi viec ma tai khoan van dang nhap duoc la mot lo hong that.
   */
  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const employee = await this.findOne(id);

    if (dto.branchId !== undefined) {
      const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
      if (!branch) {
        throw new BadRequestException('Không tìm thấy chi nhánh');
      }
    }

    const nextStatus = dto.status ?? employee.status;
    const becomesNonWorking = NON_WORKING_EMPLOYEE_STATUSES.includes(nextStatus);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Employee, id, {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.hireDate !== undefined ? { hireDate: dto.hireDate } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.status === EmployeeStatus.RESIGNED && !employee.resignedDate
          ? { resignedDate: new Date().toISOString().slice(0, 10) }
          : {}),
      });

      if (dto.status !== undefined && employee.userId) {
        await manager.update(User, employee.userId, { active: !becomesNonWorking });
      }
    });

    return this.findOne(id);
  }

  async findAll(query: QueryEmployeesDto): Promise<PaginatedResultDto<Employee>> {
    const qb = this.employeesRepository
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .leftJoinAndSelect('employee.branch', 'branch');

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('employee.fullName ILIKE :search', { search: `%${search}%` })
            .orWhere('employee.phone ILIKE :search', { search: `%${search}%` })
            .orWhere('employee.employeeCode ILIKE :search', { search: `%${search}%` });
        }),
      );
    }
    if (query.status) {
      qb.andWhere('employee.status = :status', { status: query.status });
    }
    if (query.branchId) {
      qb.andWhere('employee.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.position) {
      qb.andWhere('employee.position ILIKE :position', { position: `%${query.position}%` });
    }

    // sortBy la du lieu tu client - khong bao gio noi thang vao SQL khi chua loc.
    const sortBy =
      query.sortBy && EMPLOYEE_SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`employee.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({
      where: { id },
      relations: EMPLOYEE_RELATIONS,
    });
    if (!employee) {
      throw new NotFoundException('Không tìm thấy nhân viên');
    }
    return employee;
  }
}
