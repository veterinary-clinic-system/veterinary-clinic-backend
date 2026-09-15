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
import { Appointment, Branch, Doctor, Pet, Service, User } from '@/database/entities';
import { AppointmentStatus, SLOT_BLOCKING_STATUSES } from '@/common/enums/appointment-status.enum';
import { NotificationType } from '@/common/enums/notification.enum';
import { Role } from '@/common/enums/role.enum';
import { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { PaginatedResultDto } from '@/common/dto/paginated-result.dto';
import { NotificationsService } from '@/notifications/notifications.service';
import { PrescreeningService } from '@/prescreening/prescreening.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AvailabilityService, DayAvailability, SlotInfo, SlotStatus } from './scheduling/availability.service';
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

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Doctor) private readonly doctorsRepository: Repository<Doctor>,
    @InjectRepository(Service) private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
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

    const service = await this.servicesRepository.findOne({ where: { id: dto.serviceId, active: true } });
    if (!service) {
      throw new BadRequestException('Selected service is not available');
    }

    const owner = await this.resolveOwner(dto.phone, dto.ownerFullName, dto.email);
    const pet = await this.resolvePet(dto, owner);

    const startAt = new Date(dto.startAt);
    const endAt = addMinutes(startAt, service.durationMinutes);

    const appointment = await this.dataSource.transaction(async (manager) => {
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
      return manager.save(entity);
    });

    await this.availabilityService.invalidateDoctorDay(doctor.id, branch.id, startAt);

    await this.notificationsService.scheduleAppointmentReminder({
      appointment,
      recipientPhone: owner.phone,
      petName: pet.name,
    });

    if (appointment.commonSymptoms.length > 0 || appointment.otherSymptoms || appointment.photoUrls.length > 0) {
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
      relations: ['pet', 'pet.owner', 'doctor', 'branch', 'service', 'service.item'],
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
    query: PaginationQueryDto & { branchId?: string; doctorId?: string; status?: AppointmentStatus },
  ): Promise<PaginatedResultDto<Appointment>> {
    const qb = this.appointmentsRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.pet', 'pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('appointment.branch', 'branch')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('service.item', 'item');

    if (query.branchId) qb.andWhere('appointment.branchId = :branchId', { branchId: query.branchId });
    if (query.doctorId) qb.andWhere('appointment.doctorId = :doctorId', { doctorId: query.doctorId });
    if (query.status) qb.andWhere('appointment.status = :status', { status: query.status });

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
    const days = await this.availabilityService.getDoctorWeekAvailability(doctorId, branchId, weekStart);

    if (includeDetail) {
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

    // Public/PetOwner view: strip everything down to free/busy only.
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

  async update(id: string, dto: UpdateAppointmentDto, actor: AuthenticatedUser): Promise<Appointment> {
    const appointment = await this.findOne(id);
    const reschedule = dto.startAt !== undefined || dto.doctorId !== undefined;

    if (reschedule) {
      const doctorId = dto.doctorId ?? appointment.doctorId;
      const doctor = await this.doctorsRepository.findOne({ where: { id: doctorId } });
      if (!doctor || doctor.branchId !== appointment.branchId) {
        throw new BadRequestException('Doctor does not work at this appointment\'s branch');
      }
      const service = await this.servicesRepository.findOne({ where: { id: appointment.serviceId } });
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

      await this.availabilityService.invalidateDoctorDay(appointment.doctorId, appointment.branchId, appointment.startAt);
      await this.availabilityService.invalidateDoctorDay(doctorId, appointment.branchId, startAt);
    } else {
      await this.appointmentsRepository.update(id, {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priorityColor ? { priorityColor: dto.priorityColor } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      });
      if (dto.status) {
        // A status change (e.g. CANCELLED) can free up or occupy the slot even without a reschedule.
        await this.availabilityService.invalidateDoctorDay(appointment.doctorId, appointment.branchId, appointment.startAt);
      }
    }

    const updated = await this.findOne(id);
    await this.notifyOwnerOfUpdate(updated, actor);
    return updated;
  }

  async cancel(id: string, actor: AuthenticatedUser): Promise<Appointment> {
    if (actor.role === Role.PET_OWNER) {
      await this.findOneForOwner(id, actor); // throws ForbiddenException if not their own
    }
    return this.update(id, { status: AppointmentStatus.CANCELLED }, actor);
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

    const day = await this.availabilityService.getDoctorDayAvailability(doctorId, branchId, startAt);
    const startHHmm = `${startAt.getHours().toString().padStart(2, '0')}:${startAt
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const matchingSlot = day.slots.find((slot) => slot.start === startHHmm);

    if (!matchingSlot || (matchingSlot.status !== SlotStatus.FREE && matchingSlot.status !== SlotStatus.BOOKED)) {
      throw new BadRequestException('This time is outside the doctor\'s working hours or on a break');
    }
    if (matchingSlot.status === SlotStatus.BOOKED && matchingSlot.appointmentId !== excludeAppointmentId) {
      throw new ConflictException('This time slot was just booked - please pick another one');
    }
  }

  private async resolveOwner(phone: string, fullName: string | undefined, email: string | undefined) {
    let owner = await this.usersRepository.findOne({ where: { phone } });
    if (!owner) {
      owner = await this.usersRepository.save(
        this.usersRepository.create({
          phone,
          fullName: fullName ?? 'Khách hàng',
          email: email ?? null,
          role: Role.PET_OWNER,
          passwordHash: null,
        }),
      );
    }
    return owner;
  }

  private async resolvePet(dto: CreateBookingDto, owner: User): Promise<Pet> {
    if (dto.petId) {
      const pet = await this.petsRepository.findOne({ where: { id: dto.petId } });
      if (!pet || pet.ownerId !== owner.id) {
        throw new BadRequestException('Pet does not belong to this owner');
      }
      return pet;
    }

    if (!dto.newPet) {
      throw new BadRequestException('Either petId or newPet must be provided');
    }

    return this.petsRepository.save(
      this.petsRepository.create({
        name: dto.newPet.name,
        breedId: dto.newPet.breedId,
        gender: dto.newPet.gender,
        weight: dto.newPet.weight ?? null,
        birthDate: dto.newPet.birthDate ?? null,
        ownerId: owner.id,
      }),
    );
  }

  private async notifyOwnerOfUpdate(appointment: Appointment, actor: AuthenticatedUser): Promise<void> {
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
      message,
    });
  }
}
