import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { addMinutes, format } from 'date-fns';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { QueueEntry } from '@/modules/scheduling/domain/entities/queue-entry.entity';
import {
  AppointmentStatus,
  TERMINAL_APPOINTMENT_STATUSES,
} from '@/shared/common/enums/appointment-status.enum';
import {
  ACTIVE_QUEUE_STATUSES,
  QueueSource,
  QueueStatus,
  TERMINAL_QUEUE_STATUSES,
  isValidQueueStatusTransition,
} from '@/shared/common/enums/queue-status.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CheckInDto } from '@/modules/scheduling/presentation/dto/check-in.dto';
import { CreateWalkInDto } from '@/modules/scheduling/presentation/dto/create-walk-in.dto';
import { AssignDoctorDto } from '@/modules/scheduling/presentation/dto/assign-doctor.dto';
import { UpdateQueueEntryDto } from '@/modules/scheduling/presentation/dto/update-queue-entry.dto';
import { QueryQueueDto } from '@/modules/scheduling/presentation/dto/query-queue.dto';
import { AvailabilityService, SlotStatus } from './availability.service';
import { PartyResolverService } from './party-resolver.service';
import { mapAppointmentOverlapError } from '@/modules/scheduling/domain/appointment-overlap';

const QUEUE_DETAIL_RELATIONS = [
  'pet',
  'pet.owner',
  'pet.breed',
  'doctor',
  'branch',
  'service',
  'service.item',
  'appointment',
];

/**
 * Thu tu goi vao phong: DO truoc, XANH DUONG sau cung. Luot cho khong ghi muc uu tien
 * xep sau moi muc uu tien da ghi (do dai mang), roi moi den so thu tu.
 */
const PRIORITY_RANK_SQL = `CASE queue.priority_color
    WHEN 'RED' THEN 0
    WHEN 'ORANGE' THEN 1
    WHEN 'YELLOW' THEN 2
    WHEN 'GREEN' THEN 3
    WHEN 'BLUE' THEN 4
    ELSE 5
  END`;

/**
 * Hang cho tai quay le tan. Bon thao tac cua Section "Nhan vien co the":
 *   1. Xac nhan khach da den      -> `checkIn`
 *   2. Tao luot kham khong dat lich -> `createWalkIn`
 *   3. Dua vao hang cho           -> ca hai ham tren deu tao mot `QueueEntry`
 *   4. Gan bac si                 -> `assignDoctor`
 *
 * Quy uoc quan trong: mot luot cho CHUA gan bac si thi KHONG co `Appointment`. Bang
 * `appointments` bat buoc phai co `doctor_id` va bi rang buoc EXCLUDE
 * `appointment_no_overlap` khoa chat theo (bac si, khung gio) - nen khong the tao mot
 * lich hen "treo" cho khach vang lai. Lich hen chi ra doi tai buoc gan bac si, va luc
 * do khung gio duoc chon tu chinh luoi slot cua bac si do nen khong bao gio de len
 * mot lich hen da dat truoc.
 */
@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(QueueEntry) private readonly queueRepository: Repository<QueueEntry>,
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
    @InjectRepository(Service) private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly availabilityService: AvailabilityService,
    private readonly partyResolver: PartyResolverService,
  ) {}

  // ---------------------------------------------------------------------------------
  // 1. Xac nhan khach da den (check-in)
  // ---------------------------------------------------------------------------------

  /**
   * Khach co lich hen buoc vao phong kham: lich hen chuyen sang CHECKED_IN va mot luot
   * cho duoc mo. Bac si da co san tren lich hen nen luot cho vao thang trang thai
   * ASSIGNED, khong phai doi phan cong.
   */
  async checkIn(dto: CheckInDto, actor: AuthenticatedUser): Promise<QueueEntry> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: dto.appointmentId },
      relations: ['pet', 'service'],
    });
    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn');
    }
    if (TERMINAL_APPOINTMENT_STATUSES.has(appointment.status)) {
      throw new ConflictException(
        `Lịch hẹn đã ở trạng thái kết thúc ("${appointment.status}") - không thể check-in.`,
      );
    }

    const existing = await this.queueRepository.findOne({
      where: { appointmentId: appointment.id, status: In(ACTIVE_QUEUE_STATUSES) },
    });
    if (existing) {
      throw new ConflictException(
        `Lịch hẹn này đã được check-in (số thứ tự ${existing.ticketNumber}).`,
      );
    }

    // Con vat co the dang o trong hang cho vi mot ly do khac (vi du le tan da mo mot
    // luot vang lai cho no truoc khi nhan ra la khach co dat lich). Chi muc duy nhat
    // `uq_queue_entries_one_active_per_pet` se chan o tang CSDL, nhung bat o day de
    // le tan nhan duoc thong bao hieu duoc thay vi loi 500.
    const petInQueue = await this.queueRepository.findOne({
      where: { petId: appointment.petId, status: In(ACTIVE_QUEUE_STATUSES) },
    });
    if (petInQueue) {
      throw new ConflictException(
        `${appointment.pet.name} đang có một lượt chờ chưa kết thúc (số thứ tự ${petInQueue.ticketNumber}).`,
      );
    }

    const queueDate = format(new Date(), 'yyyy-MM-dd');

    const entry = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(QueueEntry, {
        branchId: appointment.branchId,
        petId: appointment.petId,
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        serviceId: appointment.serviceId,
        queueDate,
        ticketNumber: await this.nextTicketNumber(manager, appointment.branchId, queueDate),
        status: QueueStatus.ASSIGNED,
        source: QueueSource.APPOINTMENT,
        priorityColor: dto.priorityColor ?? appointment.priorityColor,
        commonSymptoms: appointment.commonSymptoms,
        reason: appointment.otherSymptoms,
        note: dto.note ?? null,
        checkedInAt: new Date(),
        createdByUserId: actor.userId,
      });
      const saved = await manager.save(created);

      await manager.update(Appointment, appointment.id, {
        status: AppointmentStatus.CHECKED_IN,
        ...(dto.priorityColor ? { priorityColor: dto.priorityColor } : {}),
      });

      return saved;
    });

    await this.availabilityService.invalidateDoctorDay(
      appointment.doctorId,
      appointment.branchId,
      appointment.startAt,
    );

    return this.findOne(entry.id);
  }

  // ---------------------------------------------------------------------------------
  // 2. Tao luot kham khong dat lich (walk-in) + 3. Dua vao hang cho
  // ---------------------------------------------------------------------------------

  /**
   * Khach den truc tiep. Luon tao luot cho truoc (khach da dung o quay roi - phai co
   * so thu tu ngay); viec gan bac si la buoc rieng, co the lam ngay trong cung request
   * neu le tan da chon san `doctorId`.
   *
   * Neu gan bac si that bai (bac si het khung gio trong hom nay), luot cho VAN duoc
   * giu lai o trang thai WAITING chu khong roll back - khach da xep hang thi khong the
   * bi "bien mat" chi vi mot bac si cu the ban.
   */
  async createWalkIn(dto: CreateWalkInDto, actor: AuthenticatedUser): Promise<QueueEntry> {
    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) {
      throw new BadRequestException('Không tìm thấy chi nhánh');
    }

    const service = await this.servicesRepository.findOne({
      where: { id: dto.serviceId, active: true },
    });
    if (!service) {
      throw new BadRequestException('Dịch vụ không khả dụng');
    }

    const owner = await this.partyResolver.resolveOwner(dto.phone, dto.ownerFullName);
    const pet = await this.partyResolver.resolvePet(dto, owner);

    const activeEntry = await this.queueRepository.findOne({
      where: { petId: pet.id, status: In(ACTIVE_QUEUE_STATUSES) },
    });
    if (activeEntry) {
      throw new ConflictException(
        `${pet.name} đang có một lượt chờ chưa kết thúc (số thứ tự ${activeEntry.ticketNumber}).`,
      );
    }

    const queueDate = format(new Date(), 'yyyy-MM-dd');

    const entry = await this.dataSource.transaction(async (manager) => {
      const created = manager.create(QueueEntry, {
        branchId: branch.id,
        petId: pet.id,
        appointmentId: null,
        doctorId: null,
        serviceId: service.id,
        queueDate,
        ticketNumber: await this.nextTicketNumber(manager, branch.id, queueDate),
        status: QueueStatus.WAITING,
        source: QueueSource.WALK_IN,
        priorityColor: dto.priorityColor ?? null,
        commonSymptoms: dto.commonSymptoms ?? [],
        reason: dto.reason ?? null,
        note: dto.note ?? null,
        checkedInAt: new Date(),
        createdByUserId: actor.userId,
      });
      return manager.save(created);
    });

    if (dto.doctorId) {
      return this.assignDoctor(entry.id, { doctorId: dto.doctorId }, actor);
    }

    return this.findOne(entry.id);
  }

  // ---------------------------------------------------------------------------------
  // 4. Gan bac si
  // ---------------------------------------------------------------------------------

  /**
   * Gan/doi bac si phu trach mot luot cho.
   *
   * Hai truong hop:
   *   - Luot cho DA co lich hen (khach dat truoc): doi bac si cua lich hen do sang bac
   *     si moi, tai dung khung gio cu neu con trong, khong thi khung trong som nhat.
   *   - Luot cho CHUA co lich hen (khach vang lai): tao lich hen moi tai khung trong
   *     som nhat con lai trong ngay cua bac si, trang thai CHECKED_IN (khach dang o
   *     phong kham chu khong phai vua dat lich).
   */
  async assignDoctor(
    id: string,
    dto: AssignDoctorDto,
    actor: AuthenticatedUser,
  ): Promise<QueueEntry> {
    const entry = await this.findOne(id);
    if (TERMINAL_QUEUE_STATUSES.has(entry.status)) {
      throw new ConflictException(
        `Lượt chờ đã ở trạng thái kết thúc ("${entry.status}") - không thể gán bác sĩ.`,
      );
    }

    const doctor = await this.doctorsRepository.findOne({ where: { id: dto.doctorId } });
    if (!doctor || !doctor.active) {
      throw new BadRequestException('Không tìm thấy bác sĩ hoặc bác sĩ đã ngừng hoạt động');
    }
    if (doctor.branchId !== entry.branchId) {
      throw new BadRequestException('Bác sĩ không làm việc tại chi nhánh của lượt chờ này');
    }

    const durationMinutes = entry.service?.durationMinutes ?? 30;
    const startAt = await this.resolveAssignmentStart(
      entry,
      doctor.id,
      durationMinutes,
      dto.startAt,
    );
    const endAt = addMinutes(startAt, durationMinutes);

    await mapAppointmentOverlapError(() =>
      this.dataSource.transaction(async (manager) => {
        // Cung khoa tu van theo bac si ma AppointmentsService dung - hai le tan gan
        // cung mot bac si cho hai khach cung luc khong the cung di qua buoc kiem tra
        // "khung gio con trong khong".
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [doctor.id]);
        await this.assertSlotIsFree(manager, doctor.id, startAt, endAt, entry.appointmentId);

        if (entry.appointmentId) {
          await manager.update(Appointment, entry.appointmentId, {
            doctorId: doctor.id,
            startAt,
            endAt,
            status: AppointmentStatus.CHECKED_IN,
          });
        } else {
          const appointment = await manager.save(
            manager.create(Appointment, {
              doctorId: doctor.id,
              branchId: entry.branchId,
              petId: entry.petId,
              serviceId: entry.serviceId,
              bookedByUserId: actor.userId,
              startAt,
              endAt,
              // Khach vang lai da co mat tai phong kham - lich hen sinh ra o day
              // khong bao gio di qua PENDING/CONFIRMED.
              status: AppointmentStatus.CHECKED_IN,
              priorityColor: entry.priorityColor,
              commonSymptoms: entry.commonSymptoms,
              otherSymptoms: entry.reason,
              photoUrls: [],
            }),
          );
          await manager.update(QueueEntry, entry.id, { appointmentId: appointment.id });
        }

        await manager.update(QueueEntry, entry.id, {
          doctorId: doctor.id,
          // Chi day WAITING -> ASSIGNED. Doi bac si cho mot ca DANG kham (IN_ROOM)
          // khong duoc keo nguoc trang thai ve ASSIGNED.
          ...(entry.status === QueueStatus.WAITING ? { status: QueueStatus.ASSIGNED } : {}),
        });
      }),
    );

    // Bac si cu (neu co) va bac si moi deu doi lich trong ngay -> xoa ca hai cache.
    if (entry.doctorId && entry.doctorId !== doctor.id) {
      await this.availabilityService.invalidateDoctorDay(entry.doctorId, entry.branchId, startAt);
    }
    await this.availabilityService.invalidateDoctorDay(doctor.id, entry.branchId, startAt);

    return this.findOne(id);
  }

  // ---------------------------------------------------------------------------------
  // Van hanh hang cho
  // ---------------------------------------------------------------------------------

  /**
   * Day trang thai luot cho, va dong bo trang thai lich hen di kem:
   *   IN_ROOM   -> lich hen IN_PROGRESS (bac si bat dau kham)
   *   DONE      -> KHONG dong lich hen. Lich hen chi thanh COMPLETED khi bac si ghi
   *                phieu kham - dong no o day se lam phieu kham khong ghi duoc nua.
   *   CANCELLED -> lich hen CANCELLED, kem luu vet (FR-05-04)
   *
   * Truoc P3, huy luot cho day lich hen sang NO_SHOW. Da sua thanh CANCELLED: khach
   * DA buoc vao phong kham roi moi bo ve thi khong phai la "khong den". Gop chung hai
   * viec lam bao cao ty le vang mat cua P10 sai, va FR-06-03 doi hai thao tac tach
   * bach - "khong den" gio la `POST /appointments/:id/no-show` rieng.
   */
  async update(
    id: string,
    dto: UpdateQueueEntryDto,
    actor: AuthenticatedUser,
  ): Promise<QueueEntry> {
    const entry = await this.findOne(id);

    if (dto.status && !isValidQueueStatusTransition(entry.status, dto.status)) {
      throw new ConflictException(
        `Không thể chuyển lượt chờ từ trạng thái "${entry.status}" sang "${dto.status}"`,
      );
    }

    const now = new Date();
    // Ly do huy lan sang tan lich hen (FR-05-04) nen phai co gia tri ngay ca khi le tan
    // bam huy ma khong go gi - de trong thi bao cao huy cua P10 lai la mot con so tron.
    const cancelReason = dto.reason?.trim() || 'Khách bỏ về trước khi được khám';

    const patch = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.priorityColor ? { priorityColor: dto.priorityColor } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.status === QueueStatus.IN_ROOM ? { calledAt: now } : {}),
      ...(dto.status && TERMINAL_QUEUE_STATUSES.has(dto.status) ? { finishedAt: now } : {}),
      // Luot cho giu ban sao ly do de man hinh hang cho hien duoc ma khong phai JOIN
      // sang lich hen (luot cho cua khach vang lai chua chac da co lich hen).
      ...(dto.status === QueueStatus.CANCELLED ? { cancelReason } : {}),
    };
    // `manager.update` voi mot object rong nem loi - mot PATCH khong doi gi thi chi
    // don gian tra ve nguyen trang.
    if (Object.keys(patch).length === 0) {
      return entry;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(QueueEntry, id, patch);

      if (!entry.appointmentId || !dto.status) return;

      const appointment = await manager.findOne(Appointment, {
        where: { id: entry.appointmentId },
      });
      if (!appointment || TERMINAL_APPOINTMENT_STATUSES.has(appointment.status)) return;

      if (dto.status === QueueStatus.IN_ROOM) {
        await manager.update(Appointment, entry.appointmentId, {
          status: AppointmentStatus.IN_PROGRESS,
        });
      } else if (dto.status === QueueStatus.CANCELLED) {
        await manager.update(Appointment, entry.appointmentId, {
          status: AppointmentStatus.CANCELLED,
          cancelledByUserId: actor.userId,
          cancelledAt: now,
          cancelReason,
        });
      }
    });

    if (entry.doctorId && dto.status) {
      await this.availabilityService.invalidateDoctorDay(entry.doctorId, entry.branchId, now);
    }

    return this.findOne(id);
  }

  /**
   * Hang cho cua mot ngay. Sap xep theo muc uu tien truoc, roi so thu tu - dung thu tu
   * ma man hinh quay le tan can goi khach.
   */
  async list(query: QueryQueueDto): Promise<QueueEntry[]> {
    const qb = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.pet', 'pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .leftJoinAndSelect('pet.breed', 'breed')
      .leftJoinAndSelect('queue.doctor', 'doctor')
      .leftJoinAndSelect('queue.branch', 'branch')
      .leftJoinAndSelect('queue.service', 'service')
      .leftJoinAndSelect('service.item', 'item')
      .leftJoinAndSelect('queue.appointment', 'appointment')
      .where('queue.queueDate = :date', {
        date: query.date ?? format(new Date(), 'yyyy-MM-dd'),
      });

    if (query.branchId) qb.andWhere('queue.branchId = :branchId', { branchId: query.branchId });
    if (query.doctorId) qb.andWhere('queue.doctorId = :doctorId', { doctorId: query.doctorId });

    qb.andWhere('queue.status IN (:...statuses)', {
      statuses: query.status?.length ? query.status : ACTIVE_QUEUE_STATUSES,
    });

    return qb.orderBy(PRIORITY_RANK_SQL, 'ASC').addOrderBy('queue.ticketNumber', 'ASC').getMany();
  }

  async findOne(id: string): Promise<QueueEntry> {
    const entry = await this.queueRepository.findOne({
      where: { id },
      relations: QUEUE_DETAIL_RELATIONS,
    });
    if (!entry) {
      throw new NotFoundException('Không tìm thấy lượt chờ');
    }
    return entry;
  }

  // ---------------------------------------------------------------------------------
  // Helper rieng
  // ---------------------------------------------------------------------------------

  /**
   * So thu tu ke tiep cua (chi nhanh, ngay), danh lai tu 1 moi ngay.
   *
   * `pg_advisory_xact_lock` tren cap khoa nay lam hai request cung chi nhanh phai xep
   * hang o day - neu khong, hai khach den cung luc se cung doc ra MAX() giong nhau va
   * nhan cung mot so thu tu.
   */
  private async nextTicketNumber(
    manager: EntityManager,
    branchId: string,
    queueDate: string,
  ): Promise<number> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `queue:${branchId}:${queueDate}`,
    ]);
    const row = await manager
      .createQueryBuilder(QueueEntry, 'queue')
      .select('COALESCE(MAX(queue.ticket_number), 0)', 'max')
      // `withDeleted` de mot luot cho bi xoa mem khong lam so thu tu bi cap lai.
      .withDeleted()
      .where('queue.branchId = :branchId', { branchId })
      .andWhere('queue.queueDate = :queueDate', { queueDate })
      .getRawOne<{ max: string }>();

    return Number(row?.max ?? 0) + 1;
  }

  /**
   * Khung gio se dat cho lich hen khi gan bac si, theo thu tu uu tien:
   *   1. Gio le tan chi dinh tay (`dto.startAt`).
   *   2. Gio SAN CO cua lich hen (khach dat truoc, chi doi bac si) - neu bac si moi
   *      dang ranh dung khung do thi giu nguyen, khong lam khach phai doi them.
   *   3. Khung trong som nhat con lai trong ngay cua bac si moi.
   */
  private async resolveAssignmentStart(
    entry: QueueEntry,
    doctorId: string,
    durationMinutes: number,
    explicitStartAt?: string,
  ): Promise<Date> {
    if (explicitStartAt) {
      return new Date(explicitStartAt);
    }

    if (entry.appointment) {
      const existingStart = entry.appointment.startAt;
      const free = await this.isRangeFreeForDoctor(
        doctorId,
        existingStart,
        addMinutes(existingStart, durationMinutes),
        entry.appointmentId,
      );
      if (free) {
        return existingStart;
      }
    }

    return this.findNextFreeStart(doctorId, entry.branchId, durationMinutes);
  }

  /** Doc nhanh ngoai transaction, chi de CHON gio - viec chot van do assertSlotIsFree lam. */
  private async isRangeFreeForDoctor(
    doctorId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId: string | null,
  ): Promise<boolean> {
    const qb = this.appointmentsRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.status NOT IN (:...statuses)', {
        statuses: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      })
      .andWhere('appointment.startAt < :endAt AND appointment.endAt > :startAt', {
        startAt,
        endAt,
      });

    if (excludeAppointmentId) {
      qb.andWhere('appointment.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    return !(await qb.getExists());
  }

  /**
   * Khung gio trong som nhat con lai HOM NAY cua bac si, du dai cho `durationMinutes`.
   *
   * Luoi slot la 30 phut nhung dich vu co the dai hon, nen phai kiem tra MOI slot ma
   * khoang [start, start+duration) cham vao deu con trong - khong chi rieng slot dau.
   */
  private async findNextFreeStart(
    doctorId: string,
    branchId: string,
    durationMinutes: number,
  ): Promise<Date> {
    const now = new Date();
    const day = await this.availabilityService.getDoctorDayAvailability(doctorId, branchId, now);

    if (!day.isBranchOpen) {
      throw new ConflictException('Chi nhánh không mở cửa hôm nay');
    }

    for (const slot of day.slots) {
      if (slot.status !== SlotStatus.FREE) continue;
      // Khung gio da troi qua thi khong con dung duoc.
      if (slot.endAt.getTime() <= now.getTime()) continue;

      const end = addMinutes(slot.startAt, durationMinutes);
      const covered = day.slots.filter(
        (other) => other.startAt < end && slot.startAt < other.endAt,
      );
      const longEnough = covered.length > 0 && covered[covered.length - 1].endAt >= end;
      if (longEnough && covered.every((other) => other.status === SlotStatus.FREE)) {
        return slot.startAt;
      }
    }

    throw new ConflictException(
      'Bác sĩ không còn khung giờ trống nào hôm nay - vui lòng chọn bác sĩ khác hoặc chỉ định giờ cụ thể.',
    );
  }

  /**
   * Ban sao cua kiem tra trung lich trong `AppointmentsService`, chay TRONG transaction
   * dang giu khoa tu van. Chi kiem tra bang `appointments` - luoi slot da duoc
   * `findNextFreeStart` xet roi, va khi le tan tu chi dinh `startAt` thi day la co y
   * xep them ngoai luoi (vi du ca cap cuu chen giua hai ca).
   */
  private async assertSlotIsFree(
    manager: EntityManager,
    doctorId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId: string | null,
  ): Promise<void> {
    const qb = manager
      .createQueryBuilder(Appointment, 'appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.status NOT IN (:...statuses)', {
        statuses: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      })
      .andWhere('appointment.startAt < :endAt AND appointment.endAt > :startAt', {
        startAt,
        endAt,
      });

    if (excludeAppointmentId) {
      qb.andWhere('appointment.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    if (await qb.getExists()) {
      throw new ConflictException('Khung giờ này vừa bị chiếm - vui lòng chọn giờ khác');
    }
  }
}
