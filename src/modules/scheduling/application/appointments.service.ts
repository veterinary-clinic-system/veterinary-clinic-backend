import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { addMinutes, format } from 'date-fns';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
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
import { DoctorAbsenceDto } from '@/modules/scheduling/presentation/dto/doctor-absence.dto';
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
  mergeDoctorDays,
  slotsCovering,
} from '@/modules/scheduling/application/availability.service';
import { PartyResolverService } from '@/modules/scheduling/application/party-resolver.service';
import { mapAppointmentOverlapError } from '@/modules/scheduling/domain/appointment-overlap';
import {
  SELF_BOOKING_TOO_SOON_MESSAGE,
  earliestSelfBookableStart,
} from '@/modules/scheduling/domain/booking-window';
import { startOfWeek } from 'date-fns';

const SORTABLE_COLUMNS = new Set(['startAt', 'endAt', 'status', 'priorityColor', 'createdAt']);

// Exported (not just declared) because `declaration: true` (tsconfig) requires every
// type reachable from a public method's inferred return type to be nameable in the
// emitted .d.ts - AppointmentsController's calendar endpoints return this shape
// straight through from AppointmentsService.getWeekCalendar without a manual annotation.
export interface SlotAppointmentDetail {
  id: string;
  petName: string;
  /** Giong + loai cua thu cung - o lich phai doc duoc ma khong can mo chi tiet. */
  petBreedName: string | null;
  petSpeciesName: string | null;
  ownerName: string;
  ownerPhone: string;
  /** Ten dich vu cua ca kham. */
  serviceName: string | null;
  commonSymptoms: Appointment['commonSymptoms'];
  otherSymptoms: string | null;
  priorityColor: Appointment['priorityColor'];
  status: AppointmentStatus;
}

export type SlotWithDetail = SlotInfo & { appointmentDetail?: SlotAppointmentDetail };

export interface DayAvailabilityWithDetail extends Omit<DayAvailability, 'slots'> {
  slots: SlotWithDetail[];
}

/**
 * Goc nhin cong khai: chi con free/busy, khong he lo lich hen cua nguoi khac, va moi
 * khung gio truoc `minStartAt` bi ha xuong `PAST` de giao dien lam mo chung.
 */
function stripToFreeBusy(days: DayAvailability[], minStartAt: Date): DayAvailability[] {
  return days.map((day) => ({
    ...day,
    slots: day.slots.map((slot) => ({
      start: slot.start,
      end: slot.end,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status:
        slot.startAt.getTime() < minStartAt.getTime() ? SlotStatus.PAST : slot.status,
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
    @InjectRepository(DoctorBreak)
    private readonly doctorBreaksRepository: Repository<DoctorBreak>,
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

    const service = await this.servicesRepository.findOne({
      where: { id: dto.serviceId, active: true },
    });
    if (!service) {
      throw new BadRequestException('Selected service is not available');
    }

    const startAt = new Date(dto.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);

    // Khach tu dat chi duoc dat tu NGAY MAI tro di. Le tan dat ho (`bookedByUserId` co
    // gia tri) khong bi chan - khach co the dang dung ngay o quay.
    if (bookedByUserId === null && startAt.getTime() < earliestSelfBookableStart().getTime()) {
      throw new BadRequestException(SELF_BOOKING_TOO_SOON_MESSAGE);
    }

    // `doctorId` bo trong = "de phong kham sap xep": he thong tu chon mot bac si dang
    // ranh dung khung gio do tai chi nhanh nay.
    const doctor = dto.doctorId
      ? await this.doctorsRepository.findOne({ where: { id: dto.doctorId } })
      : await this.pickAvailableDoctor(dto.branchId, startAt, endAt);
    if (!doctor || doctor.branchId !== dto.branchId) {
      throw new BadRequestException('Selected doctor does not work at the selected branch');
    }

    const owner = await this.partyResolver.resolveOwner(dto.phone, dto.ownerFullName, dto.email);
    const pet = await this.partyResolver.resolvePet(dto, owner);

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

  /**
   * Chon bac si cho lua chon "de phong kham sap xep" (khach khong chi dinh ai).
   *
   * Duyet cac bac si dang lam viec tai chi nhanh, giu lai nhung nguoi co khung gio do
   * FREE tren luoi slot cua ho, roi lay nguoi it lich nhat trong ngay - de tai kham
   * khong don het vao mot nguoi. Viec CHOT khung gio van do `assertSlotIsFree` lam ben
   * trong transaction dang giu khoa tu van, nen mot bac si vua bi chiem cho o day chi
   * dan toi 409 va khach chon lai gio, khong bao gio thanh dat trung.
   */
  private async pickAvailableDoctor(
    branchId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<Doctor | null> {
    const doctors = await this.doctorsRepository.find({ where: { branchId, active: true } });
    if (doctors.length === 0) return null;

    const candidates: { doctor: Doctor; load: number }[] = [];
    for (const doctor of doctors) {
      const day = await this.availabilityService.getDoctorDayAvailability(
        doctor.id,
        branchId,
        startAt,
      );
      // Dich vu co the dai hon mot o 30 phut - `slotsCovering` doi ca kham nam gon
      // tren luoi (dung mep, lien tuc, cham toi endAt), cung phep kiem tra ma
      // `assertSlotIsFree` dung. Neu o day de lot thi lat sau khach nhan 400 o buoc
      // chot chu khong phai mot bac si khac.
      const covered = slotsCovering(day.slots, startAt, endAt);
      if (!covered || !covered.every((slot) => slot.status === SlotStatus.FREE)) continue;

      const load = day.slots.filter((slot) => slot.status === SlotStatus.BOOKED).length;
      candidates.push({ doctor, load });
    }

    if (candidates.length === 0) {
      throw new ConflictException(
        'Không còn bác sĩ nào trống vào khung giờ này - vui lòng chọn giờ khác.',
      );
    }

    candidates.sort((a, b) => a.load - b.load);
    return candidates[0].doctor;
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
    doctorId: string | undefined,
    weekOf: Date,
    includeDetail: boolean,
  ): Promise<DayAvailability[] | DayAvailabilityWithDetail[]> {
    const weekStart = startOfWeek(weekOf, { weekStartsOn: 1 });

    const days = doctorId
      ? await this.availabilityService.getDoctorWeekAvailability(doctorId, branchId, weekStart)
      : await this.getBranchWeekAvailability(branchId, weekStart);

    // Che do gop khong co `appointmentId` tren tung o nen khong dinh kem chi tiet duoc -
    // va man hinh nhan vien luon chon mot bac si cu the, nen truong hop nay khong xay ra.
    return includeDetail && doctorId
      ? this.attachAppointmentDetail(days)
      : stripToFreeBusy(days, earliestSelfBookableStart());
  }

  /**
   * Luoi slot GOP cua ca chi nhanh - phuc vu lua chon "de phong kham sap xep bac si" o
   * buoc dat lich. Mot o con trong khi CO IT NHAT MOT bac si dang ranh o do.
   */
  private async getBranchWeekAvailability(
    branchId: string,
    weekStart: Date,
  ): Promise<DayAvailability[]> {
    const doctors = await this.doctorsRepository.find({ where: { branchId, active: true } });

    if (doctors.length === 0) {
      return Array.from({ length: 7 }, (_, offset) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + offset);
        return {
          date: format(date, 'yyyy-MM-dd'),
          dayOfWeek: date.getDay(),
          isBranchOpen: false,
          slots: [],
        };
      });
    }

    const perDoctor = await Promise.all(
      doctors.map((doctor) =>
        this.availabilityService.getDoctorWeekAvailability(doctor.id, branchId, weekStart),
      ),
    );

    return Array.from({ length: 7 }, (_, dayIndex) => {
      const sameDayAcrossDoctors = perDoctor
        .map((week) => week[dayIndex])
        .filter((day): day is DayAvailability => !!day);
      return mergeDoctorDays(sameDayAcrossDoctors)!;
    });
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
        relations: ['pet', 'pet.owner', 'pet.breed', 'pet.breed.species', 'service', 'service.item'],
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
            petBreedName: appointment.pet.breed?.breedName ?? null,
            petSpeciesName: appointment.pet.breed?.species?.speciesName ?? null,
            ownerName: appointment.pet.owner.fullName,
            ownerPhone: appointment.pet.owner.phone,
            serviceName: appointment.service?.item?.itemName ?? null,
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

  /**
   * BAC SI NGHI DOT XUAT - dong lich cua ho trong mot ngay va xu ly cac ca da dat.
   *
   * Phan hoi nghiem thu neu van de ma khong kem de xuat, nen cach xu ly o day la:
   *   1. Ghi mot `DoctorBreak` phu tron ngay -> luoi slot cua bac si do lap tuc thanh
   *      BREAK, khong ai dat them duoc nua.
   *   2. Voi tung ca CHUA tiep nhan trong ngay (PENDING/CONFIRMED), tim mot bac si khac
   *      CUNG chi nhanh dang trong DUNG khung gio do va chuyen sang. Khach giu nguyen
   *      gio hen - chi doi nguoi kham, va `update()` tu gui thong bao cho ho.
   *   3. Ca khong tim duoc nguoi thay thi GIU NGUYEN va duoc liet ke trong ket qua tra
   *      ve, de le tan goi dien doi lich thu cong. CO Y khong tu huy: huy lich cua
   *      khach ma khong hoi la quyet dinh cua phong kham, khong phai cua he thong.
   *
   * Ca DA tiep nhan (CHECKED_IN/IN_PROGRESS) khong dung toi - khach dang o phong kham
   * roi, do la viec cua quay le tan.
   */
  async handleDoctorAbsence(
    dto: DoctorAbsenceDto,
    actor: AuthenticatedUser,
  ): Promise<{
    doctorBreakId: string;
    total: number;
    reassigned: { appointmentId: string; newDoctorId: string; newDoctorName: string }[];
    unresolved: { appointmentId: string; startAt: Date; petName: string; ownerPhone: string }[];
  }> {
    const doctor = await this.doctorsRepository.findOne({ where: { id: dto.doctorId } });
    if (!doctor) {
      throw new BadRequestException('Không tìm thấy bác sĩ');
    }

    const dayStart = new Date(`${dto.date}T00:00:00`);
    const dayEnd = new Date(`${dto.date}T23:59:59.999`);

    const doctorBreak = await this.doctorBreaksRepository.save(
      this.doctorBreaksRepository.create({
        doctorId: doctor.id,
        date: dto.date,
        // Phu tron ngay lam viec - `AvailabilityService` chi so sanh chuoi 'HH:mm'.
        startTime: '00:00',
        endTime: '23:59',
        reason: dto.reason?.trim() || 'Bác sĩ nghỉ đột xuất',
      }),
    );
    await this.availabilityService.invalidateDoctorDay(doctor.id, doctor.branchId, dayStart);

    const affected = await this.appointmentsRepository.find({
      where: {
        doctorId: doctor.id,
        status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
        startAt: Between(dayStart, dayEnd),
      },
      relations: ['pet', 'pet.owner', 'service'],
      order: { startAt: 'ASC' },
    });

    const reassigned: { appointmentId: string; newDoctorId: string; newDoctorName: string }[] = [];
    const unresolved: {
      appointmentId: string;
      startAt: Date;
      petName: string;
      ownerPhone: string;
    }[] = [];

    for (const appointment of affected) {
      const replacement = dto.reassign === false ? null : await this.findReplacementDoctor(appointment, doctor.id);

      if (!replacement) {
        unresolved.push({
          appointmentId: appointment.id,
          startAt: appointment.startAt,
          petName: appointment.pet?.name ?? '',
          ownerPhone: appointment.pet?.owner?.phone ?? '',
        });
        continue;
      }

      try {
        // Di qua `update()` chu khong UPDATE thang: no giu nguyen kiem tra trung lich
        // duoi khoa tu van VA bao cho chu nuoi ve viec doi bac si.
        await this.update(appointment.id, { doctorId: replacement.id }, actor);
        reassigned.push({
          appointmentId: appointment.id,
          newDoctorId: replacement.id,
          newDoctorName: replacement.fullName,
        });
      } catch {
        unresolved.push({
          appointmentId: appointment.id,
          startAt: appointment.startAt,
          petName: appointment.pet?.name ?? '',
          ownerPhone: appointment.pet?.owner?.phone ?? '',
        });
      }
    }

    if (unresolved.length > 0) {
      await this.staffNotificationsService.notify(this.dataSource.manager, {
        type: StaffNotificationType.APPOINTMENT_CANCELLED,
        title: `Bác sĩ nghỉ ngày ${dto.date} - còn ${unresolved.length} lịch cần xử lý`,
        body:
          `${doctor.fullName} nghỉ ngày ${dto.date}. Đã chuyển được ${reassigned.length}/${affected.length} ` +
          `ca sang bác sĩ khác; ${unresolved.length} ca chưa tìm được người thay, cần gọi khách để dời lịch.`,
        link: `/staff/calendar?branchId=${doctor.branchId}&date=${dto.date}`,
        branchId: doctor.branchId,
        dedupeKey: `doctor-absence:${doctor.id}:${dto.date}`,
      });
    }

    return { doctorBreakId: doctorBreak.id, total: affected.length, reassigned, unresolved };
  }

  /**
   * Bac si cung chi nhanh dang TRONG dung khung gio cua ca nay. Uu tien nguoi it lich
   * nhat trong ngay de cac ca bi doi khong don het vao mot nguoi.
   */
  private async findReplacementDoctor(
    appointment: Appointment,
    absentDoctorId: string,
  ): Promise<Doctor | null> {
    const candidates = await this.doctorsRepository.find({
      where: { branchId: appointment.branchId, active: true },
    });

    const scored: { doctor: Doctor; load: number }[] = [];

    for (const candidate of candidates) {
      if (candidate.id === absentDoctorId) continue;
      const day = await this.availabilityService.getDoctorDayAvailability(
        candidate.id,
        appointment.branchId,
        appointment.startAt,
      );
      const covered = slotsCovering(day.slots, appointment.startAt, appointment.endAt);
      if (!covered || !covered.every((slot) => slot.status === SlotStatus.FREE)) continue;

      scored.push({
        doctor: candidate,
        load: day.slots.filter((slot) => slot.status === SlotStatus.BOOKED).length,
      });
    }

    scored.sort((a, b) => a.load - b.load);
    return scored[0]?.doctor ?? null;
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

    // MOI o ma ca kham cham vao deu phai con dung duoc, khong chi rieng o dau tien.
    //
    // Truoc day cho nay chi tim `slot.start === startHHmm` roi xet mot minh o do, nen
    // mot dich vu 60 phut (luoi la 30 phut) chi bi kiem tra dung nua dau. Hau qua tai
    // hien duoc: "Phau thuat nho" dat luc 17:00 tra ve 201 va ket thuc luc 18:00 trong
    // khi o cuoi cua ngay lam viec la 17:00-17:30; dat luc 10:30 thi de len gio nghi
    // trua 11:00-13:30. Rang buoc EXCLUDE cua CSDL khong bat duoc hai truong hop nay -
    // no chi biet cac lich hen khac, khong biet ca lam viec.
    const covered = slotsCovering(day.slots, startAt, endAt);
    if (!covered) {
      throw new BadRequestException(
        "This time is outside the doctor's working hours or on a break",
      );
    }

    for (const slot of covered) {
      if (slot.status === SlotStatus.FREE) continue;
      if (slot.status === SlotStatus.BOOKED) {
        if (slot.appointmentId === excludeAppointmentId) continue;
        throw new ConflictException('This time slot was just booked - please pick another one');
      }
      throw new BadRequestException(
        "This time is outside the doctor's working hours or on a break",
      );
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
