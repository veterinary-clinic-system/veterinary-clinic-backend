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

export interface SlotAppointmentDetail {
  id: string;
  petName: string;
  
  petBreedName: string | null;
  petSpeciesName: string | null;
  ownerName: string;
  ownerPhone: string;
  
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

    if (bookedByUserId === null && startAt.getTime() < earliestSelfBookableStart().getTime()) {
      throw new BadRequestException(SELF_BOOKING_TOO_SOON_MESSAGE);
    }

    const doctor = dto.doctorId
      ? await this.doctorsRepository.findOne({ where: { id: dto.doctorId } })
      : await this.pickAvailableDoctor(dto.branchId, startAt, endAt);
    if (!doctor || doctor.branchId !== dto.branchId) {
      throw new BadRequestException('Selected doctor does not work at the selected branch');
    }

    const owner = await this.partyResolver.resolveOwner(dto.phone, dto.ownerFullName, dto.email);
    const pet = await this.partyResolver.resolvePet(dto, owner);

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

      relations: ['pet', 'pet.owner', 'doctor', 'branch', 'service', 'service.item', 'cancelledBy'],
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

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

  async listForStaff(
    query: PaginationQueryDto & {
      branchId?: string;
      doctorId?: string;
      status?: AppointmentStatus;
      
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

      qb.andWhere(
        "appointment.startAt >= CAST(:date AS date) AND appointment.startAt < CAST(:date AS date) + INTERVAL '1 day'",
        { date: query.date },
      );
    }

    const sortColumn = SORTABLE_COLUMNS.has(query.sortBy ?? '') ? query.sortBy! : 'startAt';
    qb.orderBy(`appointment.${sortColumn}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

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

    return includeDetail && doctorId
      ? this.attachAppointmentDetail(days)
      : stripToFreeBusy(days, earliestSelfBookableStart());
  }

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

  async getDayCalendar(
    branchId: string,
    doctorId: string,
    date: Date,
  ): Promise<DayAvailabilityWithDetail> {
    const day = await this.availabilityService.getDoctorDayAvailability(doctorId, branchId, date);
    const [withDetail] = await this.attachAppointmentDetail([day]);
    return withDetail;
  }

  async getMonthCalendar(
    branchId: string,
    doctorId: string | undefined,
    monthOf: Date,
  ): Promise<MonthOverview> {
    return this.availabilityService.getMonthOverview(branchId, doctorId, monthOf);
  }

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

    if (dto.status === AppointmentStatus.CANCELLED || dto.status === AppointmentStatus.NO_SHOW) {
      throw new ConflictException(
        'Hủy lịch hoặc đánh dấu khách không đến phải thực hiện qua thao tác riêng để ghi lại lý do.',
      );
    }

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

  async cancel(
    id: string,
    dto: CancelAppointmentDto,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    if (actor.role === Role.PET_OWNER) {
      await this.findOneForOwner(id, actor); 
    }
    return this.finishAbnormally(id, AppointmentStatus.CANCELLED, dto.reason, actor);
  }

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

  private async finishAbnormally(
    id: string,
    status: AppointmentStatus.CANCELLED | AppointmentStatus.NO_SHOW,
    reason: string,
    actor: AuthenticatedUser,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);

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

    await this.availabilityService.invalidateDoctorDay(
      appointment.doctorId,
      appointment.branchId,
      appointment.startAt,
    );

    const updated = await this.findOne(id);
    await this.notifyOwnerOfUpdate(updated, actor);

    if (status === AppointmentStatus.CANCELLED) {
      await this.staffNotificationsService.notify(this.dataSource.manager, {
        type: StaffNotificationType.APPOINTMENT_CANCELLED,
        title: 'Lịch hẹn bị hủy',
        body:
          `${updated.pet?.name ?? 'Thú cưng'} — ${updated.service?.item?.itemName ?? 'dịch vụ'} ` +
          `lúc ${updated.startAt.toLocaleString('vi-VN')} đã bị hủy. Lý do: ${reason}`,
        link: `/staff/appointments/${id}`,
        branchId: updated.branchId,

        dedupeKey: `appt-cancelled:${id}`,
      });
    }

    return updated;
  }

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
    if (actor.role === Role.PET_OWNER) return; 

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
