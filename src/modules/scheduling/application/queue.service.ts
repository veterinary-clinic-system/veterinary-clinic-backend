import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Repository } from 'typeorm';
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
import { PriorityColor } from '@/shared/common/enums/priority-color.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CheckInDto } from '@/modules/scheduling/presentation/dto/check-in.dto';
import { CreateWalkInDto } from '@/modules/scheduling/presentation/dto/create-walk-in.dto';
import { AssignDoctorDto } from '@/modules/scheduling/presentation/dto/assign-doctor.dto';
import { UpdateQueueEntryDto } from '@/modules/scheduling/presentation/dto/update-queue-entry.dto';
import { QueryQueueDto } from '@/modules/scheduling/presentation/dto/query-queue.dto';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService, SlotStatus, slotsCovering } from './availability.service';
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

const PRIORITY_RANK_SQL = `CASE queue.priority_color
    WHEN 'RED' THEN 0
    WHEN 'ORANGE' THEN 1
    WHEN 'YELLOW' THEN 2
    WHEN 'GREEN' THEN 3
    WHEN 'BLUE' THEN 4
    ELSE 5
  END`;

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

    private readonly appointmentsService: AppointmentsService,
  ) {}

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
        photoUrls: appointment.photoUrls,
        videoUrls: appointment.videoUrls,
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
        photoUrls: dto.photoUrls ?? [],
        videoUrls: dto.videoUrls ?? [],
        checkedInAt: new Date(),
        createdByUserId: actor.userId,
      });
      return manager.save(created);
    });

    if (dto.doctorId) {
      return this.assignDoctor(entry.id, { doctorId: dto.doctorId }, actor);
    }

    return this.autoAssign(entry.id, branch.id, service.durationMinutes, actor);
  }

  private async autoAssign(
    entryId: string,
    branchId: string,
    durationMinutes: number,
    actor: AuthenticatedUser,
  ): Promise<QueueEntry> {
    const entry = await this.findOne(entryId);
    const candidate = await this.findEarliestFreeDoctorSlot(branchId, durationMinutes);

    if (candidate) {
      try {
        return await this.assignDoctor(
          entryId,
          { doctorId: candidate.doctorId, startAt: candidate.startAt.toISOString() },
          actor,
        );
      } catch {}
    }

    if (entry.priorityColor === PriorityColor.RED) {
      const preempted = await this.preemptForEmergency(entry, branchId, durationMinutes, actor);
      if (preempted) return preempted;
    }

    return this.findOne(entryId);
  }

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

              status: AppointmentStatus.CHECKED_IN,
              priorityColor: entry.priorityColor,
              commonSymptoms: entry.commonSymptoms,
              otherSymptoms: entry.reason,

              photoUrls: entry.photoUrls ?? [],
              videoUrls: entry.videoUrls ?? [],
            }),
          );
          await manager.update(QueueEntry, entry.id, { appointmentId: appointment.id });
        }

        await manager.update(QueueEntry, entry.id, {
          doctorId: doctor.id,

          ...(entry.status === QueueStatus.WAITING ? { status: QueueStatus.ASSIGNED } : {}),
        });
      }),
    );

    if (entry.doctorId && entry.doctorId !== doctor.id) {
      await this.availabilityService.invalidateDoctorDay(entry.doctorId, entry.branchId, startAt);
    }
    await this.availabilityService.invalidateDoctorDay(doctor.id, entry.branchId, startAt);

    return this.findOne(id);
  }

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

    const cancelReason = dto.reason?.trim() || 'Khách bỏ về trước khi được khám';

    const patch = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.priorityColor ? { priorityColor: dto.priorityColor } : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
      ...(dto.status === QueueStatus.IN_ROOM ? { calledAt: now } : {}),
      ...(dto.status && TERMINAL_QUEUE_STATUSES.has(dto.status) ? { finishedAt: now } : {}),

      ...(dto.status === QueueStatus.CANCELLED ? { cancelReason } : {}),
    };

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

      .withDeleted()
      .where('queue.branchId = :branchId', { branchId })
      .andWhere('queue.queueDate = :queueDate', { queueDate })
      .getRawOne<{ max: string }>();

    return Number(row?.max ?? 0) + 1;
  }

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

  private async findEarliestFreeDoctorSlot(
    branchId: string,
    durationMinutes: number,
  ): Promise<{ doctorId: string; startAt: Date } | null> {
    const doctors = await this.doctorsRepository.find({ where: { branchId, active: true } });

    let best: { doctorId: string; startAt: Date } | null = null;
    for (const doctor of doctors) {
      const startAt = await this.findNextFreeStart(doctor.id, branchId, durationMinutes).catch(
        () => null,
      );
      if (!startAt) continue;
      if (!best || startAt < best.startAt) {
        best = { doctorId: doctor.id, startAt };
      }
    }
    return best;
  }

  private async preemptForEmergency(
    entry: QueueEntry,
    branchId: string,
    durationMinutes: number,
    actor: AuthenticatedUser,
  ): Promise<QueueEntry | null> {
    const now = new Date();
    const endOfDay = new Date(`${format(now, 'yyyy-MM-dd')}T23:59:59.999`);

    const victims = await this.appointmentsRepository.find({
      where: {
        branchId,
        status: In([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
        startAt: Between(now, endOfDay),
      },
      order: { startAt: 'ASC' },
      relations: ['service'],
    });

    for (const victim of victims) {
      if (victim.priorityColor === PriorityColor.RED) continue;

      const victimDuration = victim.service?.durationMinutes ?? 30;
      const freedStart = victim.startAt;

      const newStart = await this.findNextFreeStart(
        victim.doctorId,
        branchId,
        victimDuration,
      ).catch(() => null);
      if (!newStart || newStart.getTime() === freedStart.getTime()) continue;

      await this.appointmentsService.update(victim.id, { startAt: newStart.toISOString() }, actor);

      try {
        return await this.assignDoctor(
          entry.id,
          { doctorId: victim.doctorId, startAt: freedStart.toISOString() },
          actor,
        );
      } catch {
        try {
          await this.appointmentsService.update(
            victim.id,
            { startAt: freedStart.toISOString() },
            actor,
          );
        } catch {}
        continue;
      }
    }

    return null;
  }

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

      if (slot.endAt.getTime() <= now.getTime()) continue;

      const covered = slotsCovering(
        day.slots,
        slot.startAt,
        addMinutes(slot.startAt, durationMinutes),
      );
      if (covered && covered.every((other) => other.status === SlotStatus.FREE)) {
        return slot.startAt;
      }
    }

    throw new ConflictException(
      'Bác sĩ không còn khung giờ trống nào hôm nay - vui lòng chọn bác sĩ khác hoặc chỉ định giờ cụ thể.',
    );
  }

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
