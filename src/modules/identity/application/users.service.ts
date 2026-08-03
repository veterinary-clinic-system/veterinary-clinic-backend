import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import { Role } from '@/shared/common/enums/role.enum';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateUserDto } from '@/modules/identity/presentation/dto/create-user.dto';
import { UpdateUserDto } from '@/modules/identity/presentation/dto/update-user.dto';
import { UpdatePasswordDto } from '@/modules/identity/presentation/dto/update-password.dto';
import { UpdateDoctorDto } from '@/modules/identity/presentation/dto/update-doctor.dto';
import { CreateDoctorShiftDto } from '@/modules/identity/presentation/dto/create-doctor-shift.dto';
import { UpdateDoctorShiftDto } from '@/modules/identity/presentation/dto/update-doctor-shift.dto';
import { CreateDoctorBreakDto } from '@/modules/identity/presentation/dto/create-doctor-break.dto';
import { PublicDoctorDto } from '@/modules/identity/presentation/dto/public-doctor.dto';

const BCRYPT_ROUNDS = 12;

/** Columns safe to interpolate into `ORDER BY user.<col>` from a client-supplied `sortBy`. */
const USER_SORTABLE_COLUMNS = new Set([
  'createdAt',
  'updatedAt',
  'fullName',
  'phone',
  'email',
  'role',
  'active',
]);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
    @InjectRepository(DoctorShift) private readonly doctorShiftsRepository: Repository<DoctorShift>,
    @InjectRepository(DoctorBreak) private readonly doctorBreaksRepository: Repository<DoctorBreak>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------------
  // Users (Admin)
  // ---------------------------------------------------------------------------------

  /**
   * Admin-only staff account creation. `branchId` is forced to `null` for ADMIN
   * regardless of what the client sent; for DOCTOR the linked `Doctor` clinical-profile
   * row is inserted in the same transaction as the `User` row.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existingPhone = await this.usersRepository.findOne({ where: { phone: dto.phone } });
    if (existingPhone) {
      throw new ConflictException('This phone number is already in use');
    }
    if (dto.email) {
      const existingEmail = await this.usersRepository.findOne({ where: { email: dto.email } });
      if (existingEmail) {
        throw new ConflictException('This email is already in use');
      }
    }

    const branchId = dto.role === Role.ADMIN ? null : (dto.branchId ?? null);
    if (branchId) {
      const branch = await this.branchesRepository.findOne({ where: { id: branchId } });
      if (!branch) {
        throw new BadRequestException('Branch not found');
      }
    }
    if (dto.role === Role.DOCTOR && !branchId) {
      throw new BadRequestException('branchId is required for doctor accounts');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const savedUser = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        phone: dto.phone,
        fullName: dto.fullName,
        email: dto.email ?? null,
        passwordHash,
        role: dto.role,
        branchId,
      });
      const persistedUser = await manager.save(user);

      if (dto.role === Role.DOCTOR) {
        const doctor = manager.create(Doctor, {
          userId: persistedUser.id,
          branchId: branchId as string,
          fullName: dto.fullName,
          avatarUrl: null,
          yearOfStart: dto.yearOfStart ?? null,
          specialization: dto.specialization ?? [],
        });
        await manager.save(doctor);
      }

      return persistedUser;
    });

    return this.findOne(savedUser.id);
  }

  async findAll(
    query: PaginationQueryDto & { role?: Role; branchId?: string },
  ): Promise<PaginatedResultDto<User>> {
    const qb = this.usersRepository.createQueryBuilder('user');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.branchId) {
      qb.andWhere('user.branchId = :branchId', { branchId: query.branchId });
    }

    const sortBy =
      query.sortBy && USER_SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`user.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * `role` and `phone` are intentionally not touched here - `UpdateUserDto` doesn't
   * declare them (swapping either is a "create a new account" operation), and the
   * global `ValidationPipe({ whitelist: true })` already strips any extra fields a
   * client tries to sneak in. An ADMIN's `branchId` is always kept `null`, mirroring
   * `create()`, since Admin is a global/HQ role.
   */
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.email !== undefined && dto.email !== user.email) {
      const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
      if (existing && existing.id !== id) {
        throw new ConflictException('This email is already in use');
      }
    }

    let branchId = user.branchId;
    if (dto.branchId !== undefined) {
      if (user.role === Role.ADMIN) {
        branchId = null;
      } else {
        const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
        if (!branch) {
          throw new BadRequestException('Branch not found');
        }
        branchId = dto.branchId;
      }
    }

    Object.assign(user, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      branchId,
    });

    await this.usersRepository.save(user);
    return this.findOne(id);
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['doctorProfile'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updatePassword(userId: string, dto: UpdatePasswordDto): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersRepository.save(user);
  }

  /** `GET /users/pet-owners?search=` - receptionist customer lookup. */
  async searchPetOwners(
    query: PaginationQueryDto & { search?: string },
  ): Promise<PaginatedResultDto<User>> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role: Role.PET_OWNER });

    if (query.search) {
      qb.andWhere('(user.phone ILIKE :search OR user.fullName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const sortBy =
      query.sortBy && USER_SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`user.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  // ---------------------------------------------------------------------------------
  // Doctors
  // ---------------------------------------------------------------------------------

  /** Public doctor directory - only `active` doctors whose linked `User` is also `active`. */
  async findPublicDoctors(branchId?: string): Promise<PublicDoctorDto[]> {
    const qb = this.doctorsRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.branch', 'branch')
      .leftJoin('doctor.user', 'user')
      .where('doctor.active = :active', { active: true })
      .andWhere('user.active = :active', { active: true });

    if (branchId) {
      qb.andWhere('doctor.branchId = :branchId', { branchId });
    }

    qb.orderBy('doctor.fullName', 'ASC');

    const doctors = await qb.getMany();
    return doctors.map((doctor) => this.toPublicDoctor(doctor));
  }

  async findPublicDoctorById(id: string): Promise<PublicDoctorDto> {
    const doctor = await this.doctorsRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.branch', 'branch')
      .leftJoin('doctor.user', 'user')
      .where('doctor.id = :id', { id })
      .andWhere('doctor.active = :active', { active: true })
      .andWhere('user.active = :active', { active: true })
      .getOne();

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    return this.toPublicDoctor(doctor);
  }

  async updateDoctor(id: string, dto: UpdateDoctorDto): Promise<Doctor> {
    const doctor = await this.findDoctorEntity(id);

    if (dto.branchId !== undefined) {
      const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
      if (!branch) {
        throw new BadRequestException('Branch not found');
      }
    }

    Object.assign(doctor, {
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.yearOfStart !== undefined ? { yearOfStart: dto.yearOfStart } : {}),
      ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
    });

    await this.doctorsRepository.save(doctor);
    return this.findDoctorEntity(id);
  }

  // ---------------------------------------------------------------------------------
  // Doctor shifts
  // ---------------------------------------------------------------------------------

  async getDoctorShifts(doctorId: string): Promise<DoctorShift[]> {
    await this.findDoctorEntity(doctorId);
    return this.doctorShiftsRepository.find({
      where: { doctorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
  }

  async createDoctorShift(doctorId: string, dto: CreateDoctorShiftDto): Promise<DoctorShift> {
    await this.findDoctorEntity(doctorId);

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const shift = this.doctorShiftsRepository.create({
      doctorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });
    return this.doctorShiftsRepository.save(shift);
  }

  async updateDoctorShift(shiftId: string, dto: UpdateDoctorShiftDto): Promise<DoctorShift> {
    const shift = await this.doctorShiftsRepository.findOne({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException('Doctor shift not found');
    }

    const startTime = dto.startTime ?? shift.startTime;
    const endTime = dto.endTime ?? shift.endTime;
    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    Object.assign(shift, {
      ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
      ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    return this.doctorShiftsRepository.save(shift);
  }

  async deleteDoctorShift(shiftId: string): Promise<void> {
    const result = await this.doctorShiftsRepository.delete(shiftId);
    if (result.affected === 0) {
      throw new NotFoundException('Doctor shift not found');
    }
  }

  // ---------------------------------------------------------------------------------
  // Doctor breaks
  // ---------------------------------------------------------------------------------

  async getDoctorBreaks(doctorId: string, date?: string): Promise<DoctorBreak[]> {
    await this.findDoctorEntity(doctorId);
    return this.doctorBreaksRepository.find({
      where: { doctorId, ...(date ? { date } : {}) },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  async createDoctorBreak(doctorId: string, dto: CreateDoctorBreakDto): Promise<DoctorBreak> {
    await this.findDoctorEntity(doctorId);

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const doctorBreak = this.doctorBreaksRepository.create({
      doctorId,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      reason: dto.reason ?? null,
    });
    return this.doctorBreaksRepository.save(doctorBreak);
  }

  async deleteDoctorBreak(breakId: string): Promise<void> {
    const result = await this.doctorBreaksRepository.delete(breakId);
    if (result.affected === 0) {
      throw new NotFoundException('Doctor break not found');
    }
  }

  // ---------------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------------

  private async findDoctorEntity(id: string): Promise<Doctor> {
    const doctor = await this.doctorsRepository.findOne({ where: { id }, relations: ['branch'] });
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    return doctor;
  }

  private toPublicDoctor(doctor: Doctor): PublicDoctorDto {
    return {
      id: doctor.id,
      fullName: doctor.fullName,
      avatarUrl: doctor.avatarUrl,
      yearOfStart: doctor.yearOfStart,
      specialization: doctor.specialization,
      branch: doctor.branch ? { id: doctor.branch.id, branchName: doctor.branch.branchName } : null,
    };
  }
}
