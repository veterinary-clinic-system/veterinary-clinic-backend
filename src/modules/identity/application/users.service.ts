import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { RefreshToken } from '@/modules/identity/domain/entities/refresh-token.entity';
import { PasswordResetCode } from '@/modules/identity/domain/entities/password-reset-code.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { DeviceToken } from '@/modules/notification/domain/entities/device-token.entity';
import { OwnerNotification } from '@/modules/notification/domain/entities/owner-notification.entity';
import { AppointmentStatus } from '@/shared/common/enums/appointment-status.enum';
import { AUDIT_RECORDER, AuditRecorder } from '@/shared/common/audit/audit-recorder.port';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';
import { UpdateMyProfileDto } from '@/modules/identity/presentation/dto/update-my-profile.dto';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import { BRANCH_SCOPED_ROLES, Role } from '@/shared/common/enums/role.enum';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import {
  DEFAULT_DOCTOR_IMAGE,
  DEFAULT_STAFF_IMAGE,
  DEFAULT_USER_IMAGE,
} from '@/shared/storage/cloudinary-web-assets';
import { CreateUserDto } from '@/modules/identity/presentation/dto/create-user.dto';
import { UpdateUserDto } from '@/modules/identity/presentation/dto/update-user.dto';
import { UpdatePasswordDto } from '@/modules/identity/presentation/dto/update-password.dto';
import { UpdateDoctorDto } from '@/modules/identity/presentation/dto/update-doctor.dto';
import { CreateDoctorShiftDto } from '@/modules/identity/presentation/dto/create-doctor-shift.dto';
import { UpdateDoctorShiftDto } from '@/modules/identity/presentation/dto/update-doctor-shift.dto';
import { CreateDoctorBreakDto } from '@/modules/identity/presentation/dto/create-doctor-break.dto';
import { PublicDoctorDto } from '@/modules/identity/presentation/dto/public-doctor.dto';

const BCRYPT_ROUNDS = 12;

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
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: AuditRecorder,
  ) {}

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
    if (BRANCH_SCOPED_ROLES.includes(dto.role) && !branchId) {
      throw new BadRequestException(`branchId is required for ${dto.role} accounts`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const savedUser = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        phone: dto.phone,
        fullName: dto.fullName,
        avatarUrl:
          dto.avatarUrl ?? (dto.role === Role.DOCTOR ? DEFAULT_DOCTOR_IMAGE : DEFAULT_STAFF_IMAGE),
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
          avatarUrl: dto.avatarUrl ?? DEFAULT_DOCTOR_IMAGE,
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
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      branchId,
    });

    await this.usersRepository.save(user);
    if (dto.avatarUrl !== undefined && user.role === Role.DOCTOR) {
      await this.doctorsRepository.update({ userId: id }, { avatarUrl: dto.avatarUrl });
    }
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

  /** Chủ nuôi tự sửa hồ sơ (họ tên, email, ngày sinh, địa chỉ, ảnh đại diện). */
  async updateMyProfile(userId: string, dto: UpdateMyProfileDto): Promise<User> {
    const user = await this.getMe(userId);
    if (user.role !== Role.PET_OWNER) {
      throw new ForbiddenException('Nhân viên đổi thông tin qua quản trị viên');
    }

    const email = dto.email === undefined ? undefined : dto.email?.trim() || null;
    if (email && email !== user.email) {
      const existing = await this.usersRepository.findOne({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email này đã được sử dụng');
      }
    }

    await this.usersRepository.update(userId, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(dto.dateOfBirth !== undefined ? { dateOfBirth: dto.dateOfBirth } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
    });
    return this.getMe(userId);
  }

  /**
   * Chủ nuôi tự xoá tài khoản (yêu cầu của Google Play). Hồ sơ khám, hoá đơn, đơn thuốc của
   * các bé phải giữ lại theo quy định lưu trữ hồ sơ thú y và sổ sách, nên tài khoản được
   * ẨN DANH thay vì xoá dòng: bỏ họ tên/SĐT/email/địa chỉ/mật khẩu, khoá đăng nhập, thu hồi
   * mọi phiên, gỡ máy nhận push và hộp thông báo. Số điện thoại được giải phóng để đăng ký
   * lại từ đầu nếu muốn.
   */
  async deleteMyAccount(userId: string, password: string): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.role !== Role.PET_OWNER) {
      throw new ForbiddenException('Tài khoản nhân viên do quản trị viên quản lý');
    }
    // 400 chứ không 401: 401 làm client tưởng phiên hết hạn và đi refresh token.
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu không đúng');
    }

    const upcoming = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .innerJoin('appointment.pet', 'pet')
      .where('pet.ownerId = :ownerId', { ownerId: userId })
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
        `Bạn còn ${upcoming} lịch hẹn chưa kết thúc - vui lòng huỷ lịch (hoặc chờ khám xong) ` +
          'trước khi xoá tài khoản.',
      );
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.update(RefreshToken, { userId, revokedAt: IsNull() }, { revokedAt: now });
      await manager.delete(DeviceToken, { userId });
      await manager.delete(OwnerNotification, { recipientUserId: userId });
      await manager.delete(PasswordResetCode, { userId });
      await manager.update(User, userId, {
        // varchar(20), unique: "del-" + 16 ký tự hex.
        phone: `del-${randomBytes(8).toString('hex')}`,
        email: null,
        fullName: 'Tài khoản đã xoá',
        avatarUrl: DEFAULT_USER_IMAGE,
        passwordHash: null,
        dateOfBirth: null,
        address: null,
        note: `Chủ nuôi tự xoá tài khoản qua app ngày ${now.toLocaleDateString('vi-VN')}.`,
        active: false,
      });
    });

    this.auditRecorder.record({
      actorUserId: userId,
      action: AuditAction.DELETE,
      entityName: 'User',
      entityId: userId,
      changes: { selfService: true, anonymized: true },
      ipAddress: null,
      userAgent: null,
    });
  }

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
