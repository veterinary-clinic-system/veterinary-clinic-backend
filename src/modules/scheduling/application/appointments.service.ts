import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { addMinutes } from 'date-fns';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import {
  AppointmentStatus,
  SLOT_BLOCKING_STATUSES,
  TERMINAL_APPOINTMENT_STATUSES,
  isValidAppointmentStatusTransition,
} from '@/shared/common/enums/appointment-status.enum';
import { NotificationType } from '@/shared/common/enums/notification.enum';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '@/shared/common/dto/pagination-query.dto';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import {
  NotificationsService,
  OutboxService,
  StaffNotificationsService,
} from '@/modules/notification/application';
import { StaffNotificationType } from '@/shared/common/enums/staff-notification.enum';
import { PrescreeningService } from '@/modules/triage/application';
import { CreateBookingDto } from '@/modules/scheduling/presentation/dto/create-booking.dto';
import { UpdateAppointmentDto } from '@/modules/scheduling/presentation/dto/update-appointment.dto';
import {
  CancelAppointmentDto,
  MarkNoShowDto,
} from '@/modules/scheduling/presentation/dto/cancel-appointment.dto';
import {
  AvailabilityService,
  DayAvailability,
  MonthOverview,
  SlotInfo,
  SlotStatus,
} from '@/modules/scheduling/application/availability.service';
import { PartyResolverService } from '@/modules/scheduling/application/party-resolver.service';
import { mapAppointmentOverlapError } from '@/modules/scheduling/domain/appointment-overlap';
import { startOfWeek } from 'date-fns';

const SORTABLE_COLUMNS = new Set(['startAt', 'endAt', 'status', 'priorityColor', 'createdAt']);

// Exported (not just declared) because `declaration: true` (tsconfig) requires every
// type reachable from a public method's inferred return type to be nameable in the
// emitted .d.ts - AppointmentsController's calendar endpoints return this shape
// straight through from AppointmentsService.getWeekCalendar without a manual annotation.
export interface SlotAppointmentDetail {
  id: string;
  petName: string;
  ownerName: string;
  ownerPhone: string;
  commonSymptoms: Appointment['commonSymptoms'];
  otherSymptoms: string | null;
  priorityColor: Appointment['priorityColor'];
  status: AppointmentStatus;
}

export type SlotWithDetail = SlotInfo & { appointmentDetail?: SlotAppointmentDetail };

export interface DayAvailabilityWithDetail extends Omit<DayAvailability, 'slots'> {
  slots: SlotWithDetail[];
}

/** Goc nhin cong khai: chi con free/busy, khong he lo lich hen cua nguoi khac. */
function stripToFreeBusy(days: DayAvailability[]): DayAvailability[] {
  return days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => ({
      start: slot.start,
      end: slot.end,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: slot.status,
    })),
  }));
}

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
    @InjectRepository(Service) private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly availabilityService: AvailabilityService,
    private readonly partyResolver: PartyResolverService,
    private readonly notificationsService: NotificationsService,
    private readonly outboxService: OutboxService,
    private readonly staffNotificationsService: StaffNotificationsService,
    private readonly prescreeningService: PrescreeningService,
  ) {}

  /**
   * Guest/PetOwner self-booking, or a Receptionist booking on an owner's behalf
   * (`bookedByUserId` set in that case) - Section 4.1.2. Branch is validated before
   * doctor (the doctor must staff that branch), the slot is re-validated server-side
   * against AvailabilityService, and the insert is guarded by a per-doctor Postgres
   * advisory lock so two concurrent requests can never double-book the same slot.
   */
  async createBooking(dto: CreateBookingDto, bookedByUserId: string | null): Promise<Appointment> {
    const branch = await this.branchesRepository.findOne({ where: { id: dto.branchId } });
    if (!branch) {
      throw new BadRequestException('Branch not found');
    }

    const doctor = await this.doctorsRepository.findOne({ where: { id: dto.doctorId } });
    if (!doctor || doctor.branchId !== dto.branchId) {
      throw new BadRequestException('Selected doctor does not work at the selected branch');
    }

    const service = await this.servicesRepository.findOne({
      where: { id: dto.serviceId, active: true },
    });
    if (!service) {
      throw new BadRequestException('Selected service is not available');
    }

    const owner = await this.partyResolver.resolveOwner(dto.phone, dto.ownerFullName, dto.email);
    const pet = await this.partyResolver.resolvePet(dto, owner);

    const startAt = new Date(dto.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);

    // Bao ngoai transaction: neu rang buoc EXCLUDE cua CSDL chan (truong hop hai
    // request lot qua duoc kiem tra o tang ung dung), doi loi tho 23P01 thanh 409
    // thay vi de no thanh 500. Xem domain/appointment-overlap.ts.
    const appointment = await mapAppointmentOverlapError(() =>
      this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [doctor.id]);

        await this.assertSlotIsFree(doctor.id, branch.id, startAt, endAt);

        const entity = manager.create(Appointment, {
          doctorId: doctor.id,
          branchId: branch.id,
          petId: pet.id,
          serviceId: service.id,
          bookedByUserId,
          startAt,
          endAt,
          status: AppointmentStatus.PENDING,
          commonSymptoms: dto.commonSymptoms ?? [],
          otherSymptoms: dto.otherSymptoms ?? null,
          photoUrls: dto.photoUrls ?? [],
          address: dto.address ?? null,
        });
        const saved = await manager.save(entity);

        // Transactional Outbox (Phan IV.2): su kien nhac lich duoc ghi trong CUNG
        // transaction voi lich hen. Neu transaction rollback thi su kien cung mat -
        // khong bao gio co chuyen khach nhan tin nhan ve mot lich hen khong ton tai.
        // Nguoc lai, khi lich hen da commit thi su kien chac chan co mat va worker
        // se gui, ke ca khi api chet ngay sau do.
        await this.outboxService.record(manager, {
          type: 'APPOINTMENT_CREATED',
          dedupeKey: `appt:${saved.id}:created`,
          payload: {
            appointmentId: saved.id,
            recipientPhone: owner.phone,
            message:
              `Nhac lich: ${pet.name} co lich hen luc ` +
              `${startAt.toLocaleString('vi-VN')}. Vui long den dung gio.`,
          },
        });

        return saved;
      }),
    );

    await this.availabilityService.invalidateDoctorDay(doctor.id, branch.id, startAt);

    await this.notificationsService.scheduleAppointmentReminder({
      appointment,
      recipientPhone: owner.phone,
      recipientEmail: owner.email,
      petName: pet.name,
    });

    if (
      appointment.commonSymptoms.length > 0 ||
      appointment.otherSymptoms ||
      appointment.photoUrls.length > 0
    ) {
      const petWithBreed = await this.petsRepository.findOne({
        where: { id: pet.id },
        relations: ['breed', 'breed.species'],
      });
      await this.prescreeningService.runForAppointmentSafely(appointment, petWithBreed!);
    }

    return this.findOne(appointment.id);
  }

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id },
      // `cancelledBy` de man hinh chi tiet hien duoc "Da huy boi ..." (FR-05-04) ma
      // khong phai goi them mot request tra ten nguoi dung.
      relations: ['pet', 'pet.owner', 'doctor', 'branch', 'service', 'service.item', 'cancelledBy'],
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  /** PetOwner viewing their own history; guards against viewing someone else's appointment. */
  async findOneForOwner(id: string, actor: AuthenticatedUser): Promise<Appointment> {
    const appointment = await this.findOne(id);
    if (appointment.pet.ownerId !== actor.userId) {
      throw new ForbiddenException('You can only view your own appointments');
    }
    return appointment;
  }

  async listForOwner(actor: AuthenticatedUser): Promise<Appointment[]> {
    return this.appointmentsRepository.find({
      where: { pet: { ownerId: actor.userId } },
      relations: ['pet', 'doctor', 'branch', 'service', 'service.item'],
      order: { startAt: 'DESC' },
    });
  }

  /** Staff list view backing the Table basic component (Section 7.3). */
  async listForStaff(
    query: PaginationQueryDto & {
      branchId?: string;
      doctorId?: string;
      status?: AppointmentStatus;
      /** 'yyyy-MM-dd' - lich hen BAT DAU trong ngay do (theo mui gio cua may chu). */
      date?: string;
    },
  ): Promise<PaginatedResultDto<Appointment>> {
    const qb = this.appointmentsRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.pet', 'pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.branch', 'branch')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('service.item', 'item');

    if (query.branchId)
      qb.andWhere('appointment.branchId = :branchId', { branchId: query.branchId });
    if (query.doctorId)
      qb.andWhere('appointment.doctorId = :doctorId', { doctorId: query.doctorId });
    if (query.status) qb.andWhere('appointment.status = :status', { status: query.status });
    if (query.date) {
      // So sanh tren nua khoang [ngay, ngay+1) thay vi CAST(start_at AS date) = ... de
      // con dung duoc chi muc tren (doctor_id, start_at).
      qb.andWhere(
        "appointment.startAt >= CAST(:date AS date) AND appointment.startAt < CAST(:date AS date) + INTERVAL '1 day'",
        { date: query.date },
      );
    }

    // sortBy is caller-controlled input - never interpolate it unchecked into raw SQL.
    const sortColumn = SORTABLE_COLUMNS.has(query.sortBy ?? '') ? query.sortBy! : 'startAt';
    qb.orderBy(`appointment.${sortColumn}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /**
   * Backs the calendar.png-style week view (Section 5.2). `includeDetail` must be false
   * for the public/PetOwner booking widget and true only for Doctor/Receptionist/Admin -
   * Section 4.2: "PetOwner and Guest... only ever see which slots are free, never
   * another person's appointment details."
   */
  async getWeekCalendar(
    branchId: string,
    doctorId: string,
    weekOf: Date,
    includeDetail: boolean,
  ): Promise<DayAvailability[] | DayAvailabilityWithDetail[]> {
    const weekStart = startOfWeek(weekOf, { weekStartsOn: 1 });
    const days = await this.availabilityService.getDoctorWeekAvailability(
      doctorId,
      branchId,
      weekStart,
    );

    return includeDetail ? this.attachAppointmentDetail(days) : stripToFreeBusy(days);
  }

  /**
   * Che do NGAY cua lich lam viec (FR-05-03). Cung du lieu voi mot cot cua che do tuan -
   * dung lai `getDoctorDayAvailability` thay vi dung mot duong tinh toan thu hai.
   */
  async getDayCalendar(
    branchId: string,
    doctorId: string,
    date: Date,
  ): Promise<DayAvailabilityWithDetail> {
    const day = await this.availabilityService.getDoctorDayAvailability(doctorId, branchId, date);
    const [withDetail] = await this.attachAppointmentDetail([day]);
    return withDetail;
  }

  /**
   * Che do THANG (FR-05-03) - chi so lieu tong hop moi ngay, khong co luoi slot.
   * Xem ghi chu trong `AvailabilityService.getMonthOverview` ve ly do.
   */
  async getMonthCalendar(
    branchId: string,
    doctorId: string | undefined,
    monthOf: Date,
  ): Promise<MonthOverview> {
    return this.availabilityService.getMonthOverview(branchId, doctorId, monthOf);
  }

  /**
   * Gan chi tiet lich hen vao cac o da duoc dat. Chi danh cho Doctor/Receptionist/Admin -
   * Section 4.2: "PetOwner and Guest... only ever see which slots are free, never another
   * person's appointment details."
   */
  private async attachAppointmentDetail(
    days: DayAvailability[],
  ): Promise<DayAvailabilityWithDetail[]> {
    const appointmentIds = days
      .flatMap((day) => day.slots)
      .filter((slot) => slot.status === SlotStatus.BOOKED && slot.appointmentId)
      .map((slot) => slot.appointmentId!);

    const byId = new Map<string, Appointment>();
    if (appointmentIds.length > 0) {
      const appointments = await this.appointmentsRepository.find({
        where: appointmentIds.map((id) => ({ id })),
        relations: ['pet', 'pet.owner'],
      });
      appointments.forEach((appointment) => byId.set(appointment.id, appointment));
    }

    return days.map((day) => ({
      ...day,
      slots: day.slots.map((slot): SlotWithDetail => {
        const appointment = slot.appointmentId ? byId.get(slot.appointmentId) : undefined;
        if (!appointment) {
          return slot;
        }
        return {
          ...slot,
          appointmentDetail: {
            id: appointment.id,
            petName: appointment.pet.name,
            ownerName: appointment.pet.owner.fullName,
            ownerPhone: appointment.pet.owner.phone,
            commonSymptoms: appointment.commonSymptoms,
            otherSymptoms: appointment.otherSymptoms,
            priorityColor: appointment.priorityColor,
            status: appointment.status,
          },
        };
      }),
    }));
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);

    // FR-05-04: huy lich va danh vang phai di qua endpoint rieng de bat buoc co ly do.
    // Neu de PATCH lam duoc luon thi luu vet se thieu bat cu luc nao ai do dung nham
    // cua - va do la dung trang thai ma FR-05-04 sinh ra de xoa bo.
    if (dto.status === AppointmentStatus.CANCELLED || dto.status === AppointmentStatus.NO_SHOW) {
      throw new ConflictException(
        'Hủy lịch hoặc đánh dấu khách không đến phải thực hiện qua thao tác riêng để ghi lại lý do.',
      );
    }

    // Lich hen da ket thuc (COMPLETED/CANCELLED/NO_SHOW) la su kien lich su, khong
    // the doi status hay doi lich nua - truoc day thieu kiem tra nay nen PATCH co
    // the dua mot lich COMPLETED lui ve PENDING, hoac nhay thang PENDING -> COMPLETED
    // (van hop le - xem NON_TERMINAL_ORDER) nhung khong the "mo lai" mot lich da xong.
    if (dto.status && !isValidAppointmentStatusTransition(appointment.status, dto.status)) {
      throw new ConflictException(
        `Khong the chuyen lich hen tu trang thai "${appointment.status}" sang "${dto.status}"`,
      );
    }
    if (
      (dto.startAt !== undefined || dto.doctorId !== undefined) &&
      TERMINAL_APPOINTMENT_STATUSES.has(appointment.status)
    ) {
      throw new ConflictException(
        `Khong the doi lich cho mot lich hen da o trang thai ket thuc ("${appointment.status}")`,
      );
    }

    const reschedule = dto.startAt !== undefined || dto.doctorId !== undefined;

    if (reschedule) {
      const doctorId = dto.doctorId ?? appointment.doctorId;
      const doctor = await this.doctorsRepository.findOne({ where: { id: doctorId } });
      if (!doctor || doctor.branchId !== appointment.branchId) {
        throw new BadRequestException("Doctor does not work at this appointment's branch");
      }
      const service = await this.servicesRepository.findOne({
        where: { id: appointment.serviceId },
      });
      const startAt = dto.startAt ? new Date(dto.startAt) : appointment.startAt;
      const endAt = addMinutes(startAt, service?.durationMinutes ?? 30);

      // Everything is written as one partial update (reschedule fields + status/color/notes)
      // inside the same transaction/lock, so a trailing full-entity save can't clobber the
      // just-written startAt/doctorId with the stale in-memory `appointment` snapshot.
      await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [doctorId]);
        await this.assertSlotIsFree(doctorId, appointment.branchId, startAt, endAt, appointment.id);
        await manager.update(Appointment, id, {
          doctorId,
          startAt,
          endAt,
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.priorityColor ? { priorityColor: dto.priorityColor } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        });
      });

      await this.availabilityService.invalidateDoctorDay(
        appointment.doctorId,
        appointment.branchId,
        appointment.startAt,
      );
      await this.availabilityService.invalidateDoctorDay(doctorId, appointment.branchId, startAt);
    } else {
      await this.appointmentsRepository.update(id, {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priorityColor ? { priorityColor: dto.priorityColor } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      });
      if (dto.status) {
        // A status change (e.g. CANCELLED) can free up or occupy the slot even without a reschedule.
        await this.availabilityService.invalidateDoctorDay(
          appointment.doctorId,
          appointment.branchId,
          appointment.startAt,
        );
      }
    }

    const updated = await this.findOne(id);
    await this.notifyOwnerOfUpdate(updated, actor);
    return updated;
  }

  /**
   * Huy lich hen - FR-05-04 doi ghi lai nguoi huy, thoi diem va ly do.
   *
   * Khong con di qua `update()`: mot `PATCH { status: CANCELLED }` khong mang theo ly
   * do, va de no lam duong huy thu hai co nghia la luu vet se thieu bat ky luc nao ai
   * do dung nham cua. `update()` gio tu choi thang hai trang thai nay.
   */
  async cancel(
    id: string,
    dto: CancelAppointmentDto,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    if (actor.role === Role.PET_OWNER) {
      await this.findOneForOwner(id, actor); // throws ForbiddenException if not their own
    }
    return this.finishAbnormally(id, AppointmentStatus.CANCELLED, dto.reason, actor);
  }

  /**
   * Danh dau khach KHONG DEN - FR-06-03, thao tac doc lap voi viec huy lich.
   *
   * Chi ap dung cho lich CHUA tiep nhan. Khach da check-in roi bo ve giua chung la
   * chuyen khac han (huy luot cho - xem `QueueService.update`), gop chung se lam bao
   * cao ty le vang mat cua P10 sai.
   */
  async markNoShow(id: string, dto: MarkNoShowDto, actor: AuthenticatedUser): Promise<Appointment> {
    const appointment = await this.findOne(id);
    if (
      appointment.status === AppointmentStatus.CHECKED_IN ||
      appointment.status === AppointmentStatus.IN_PROGRESS
    ) {
      throw new ConflictException(
        'Khách đã được tiếp nhận nên không thể đánh dấu "không đến" - hãy hủy lượt chờ nếu khách bỏ về.',
      );
    }

    return this.finishAbnormally(
      id,
      AppointmentStatus.NO_SHOW,
      dto.reason?.trim() || 'Khách không đến',
      actor,
    );
  }

  /**
   * Duong di duy nhat dua mot lich hen sang CANCELLED/NO_SHOW. Doi trang thai va ghi
   * ba truong luu vet trong CUNG mot lenh UPDATE - khong the co lich da huy ma khong
   * biet ai huy.
   */
  private async finishAbnormally(
    id: string,
    status: AppointmentStatus.CANCELLED | AppointmentStatus.NO_SHOW,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);

    // Kiem tra trang thai ket thuc TRUOC `isValidAppointmentStatusTransition`: ham do
    // coi `from === to` la hop le (de PATCH chi doi ghi chu van gui kem status hien
    // tai duoc), nen neu chi dua vao no thi huy lai mot lich DA huy se di lot va ghi
    // de len luu vet cu - mat ca nguoi huy lan ly do that su.
    if (TERMINAL_APPOINTMENT_STATUSES.has(appointment.status)) {
      throw new ConflictException(
        `Lịch hẹn đã ở trạng thái kết thúc ("${appointment.status}") - không thể thực hiện lại thao tác này.`,
      );
    }

    if (!isValidAppointmentStatusTransition(appointment.status, status)) {
      throw new ConflictException(
        `Khong the chuyen lich hen tu trang thai "${appointment.status}" sang "${status}"`,
      );
    }

    await this.appointmentsRepository.update(id, {
      status,
      cancelledByUserId: actor.userId,
      cancelledAt: new Date(),
      cancelReason: reason,
    });

    // Khung gio duoc tra lai cho bac si ngay khi lich thoat khoi SLOT_BLOCKING_STATUSES.
    await this.availabilityService.invalidateDoctorDay(
      appointment.doctorId,
      appointment.branchId,
      appointment.startAt,
    );

    const updated = await this.findOne(id);
    await this.notifyOwnerOfUpdate(updated, actor);

    // Bao cho le tan va quan ly - bang muc 18 SRS (P10-T5). CHI khi HUY, khong khi
    // NO_SHOW: "khach khong den" la ket qua duoc ghi nhan sau gio hen, khong con viec
    // gi de ai xu ly ngay; con mot lich bi huy thi con khung gio vua trong ra va co
    // the con khach dang cho duoc xep vao do.
    if (status === AppointmentStatus.CANCELLED) {
      await this.staffNotificationsService.notify(this.dataSource.manager, {
        type: StaffNotificationType.APPOINTMENT_CANCELLED,
        title: 'Lịch hẹn bị hủy',
        body:
          `${updated.pet?.name ?? 'Thú cưng'} — ${updated.service?.item?.itemName ?? 'dịch vụ'} ` +
          `lúc ${updated.startAt.toLocaleString('vi-VN')} đã bị hủy. Lý do: ${reason}`,
        link: `/staff/appointments/${id}`,
        branchId: updated.branchId,
        // Mot lich chi huy duoc dung mot lan (`TERMINAL_APPOINTMENT_STATUSES` chan lan
        // hai), nen id la du de khoa - khong can gan them moc thoi gian.
        dedupeKey: `appt-cancelled:${id}`,
      });
    }

    return updated;
  }

  /** Section 4.1.4: "Optionally schedule a follow-up visit" - links back via parentAppointmentId. */
  async scheduleFollowUp(
    parentId: string,
    dto: Pick<CreateBookingDto, 'doctorId' | 'branchId' | 'serviceId' | 'startAt'>,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    const parent = await this.findOne(parentId);
    const doctor = await this.doctorsRepository.findOne({ where: { id: dto.doctorId } });
    if (!doctor || doctor.branchId !== dto.branchId) {
      throw new BadRequestException('Selected doctor does not work at the selected branch');
    }
    const service = await this.servicesRepository.findOne({ where: { id: dto.serviceId } });
    if (!service) {
      throw new BadRequestException('Selected service is not available');
    }

    const startAt = new Date(dto.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);

    const appointment = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [doctor.id]);
      await this.assertSlotIsFree(doctor.id, dto.branchId, startAt, endAt);
      const entity = manager.create(Appointment, {
        doctorId: doctor.id,
        branchId: dto.branchId,
        petId: parent.petId,
        serviceId: service.id,
        bookedByUserId: actor.userId,
        parentAppointmentId: parent.id,
        startAt,
        endAt,
        status: AppointmentStatus.PENDING,
        commonSymptoms: [],
        photoUrls: [],
      });
      return manager.save(entity);
    });

    await this.availabilityService.invalidateDoctorDay(doctor.id, dto.branchId, startAt);

    return this.findOne(appointment.id);
  }

  private async assertSlotIsFree(
    doctorId: string,
    branchId: string,
    startAt: Date,
    endAt: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    // KHONG DAT DUOC LICH TRONG QUA KHU - SRS muc 16 (P10-T8).
    //
    // Thieu cho nay cho toi P10: mot POST voi `startAt` nam nam 2020 tra ve 201 va tao
    // that mot lich hen. Khong phep kiem tra nao khac bat duoc no - `@IsDateString()`
    // chi kiem dinh dang, con luoi khung gio thi chi hoi "gio nay co trong ca lam viec
    // khong", ma 16:00 cua mot ngay nam 2020 thi van la 16:00. Hau qua khong chi la mot
    // ban ghi rac: bao cao ty le vang mat cua P10-T4 dem cac lich "da den han" nen mot
    // lich qua khu khong ai den se tinh vao mau so ngay lap tuc.
    //
    // Dat o day chu khong o DTO de moi duong tao lich deu di qua - `createBooking`,
    // `scheduleFollowUp` va moi lan doi gio ve sau.
    if (startAt.getTime() < Date.now()) {
      throw new BadRequestException('Không thể đặt lịch hẹn vào thời điểm trong quá khứ');
    }

    const overlapping = await this.appointmentsRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.status IN (:...statuses)', { statuses: SLOT_BLOCKING_STATUSES })
      .andWhere('appointment.startAt < :endAt AND appointment.endAt > :startAt', { startAt, endAt })
      .andWhere(excludeAppointmentId ? 'appointment.id != :excludeId' : '1=1', {
        excludeId: excludeAppointmentId,
      })
      .getExists();

    if (overlapping) {
      throw new ConflictException('This time slot was just booked - please pick another one');
    }

    const day = await this.availabilityService.getDoctorDayAvailability(
      doctorId,
      branchId,
      startAt,
    );
    const startHHmm = `${startAt.getHours().toString().padStart(2, '0')}:${startAt
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const matchingSlot = day.slots.find((slot) => slot.start === startHHmm);

    if (
      !matchingSlot ||
      (matchingSlot.status !== SlotStatus.FREE && matchingSlot.status !== SlotStatus.BOOKED)
    ) {
      throw new BadRequestException(
        "This time is outside the doctor's working hours or on a break",
      );
    }
    if (
      matchingSlot.status === SlotStatus.BOOKED &&
      matchingSlot.appointmentId !== excludeAppointmentId
    ) {
      throw new ConflictException('This time slot was just booked - please pick another one');
    }
  }

  private async notifyOwnerOfUpdate(
    appointment: Appointment,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (actor.role === Role.PET_OWNER) return; // owner updating their own booking doesn't need a self-notification

    const label = appointment.priorityColor ? ` Mức độ ưu tiên: ${appointment.priorityColor}.` : '';
    const message =
      appointment.status === AppointmentStatus.CANCELLED
        ? `Lịch hẹn cho ${appointment.pet.name} đã bị hủy.`
        : `Lịch hẹn cho ${appointment.pet.name} đã được cập nhật. Thời gian: ${appointment.startAt.toLocaleString('vi-VN')}.${label}`;

    await this.notificationsService.notifyNow({
      appointment,
      type:
        appointment.status === AppointmentStatus.CANCELLED
          ? NotificationType.APPOINTMENT_CANCELLED
          : NotificationType.APPOINTMENT_UPDATED,
      recipientPhone: appointment.pet.owner.phone,
      recipientEmail: appointment.pet.owner.email,
      message,
    });
  }
}
