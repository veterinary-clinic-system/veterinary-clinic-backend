import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { format } from 'date-fns';
import type Redis from 'ioredis';
import { OperatingHour } from '@/modules/organization/domain/entities/operating-hour.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import { SLOT_BLOCKING_STATUSES } from '@/shared/common/enums/appointment-status.enum';
import { REDIS_CLIENT } from '@/shared/redis/redis.constants';
import {
  generateSlots,
  rangesOverlap,
  TimeRange,
} from '@/modules/scheduling/domain/slot-grid.util';

const CACHE_TTL_SECONDS = 20;

export enum SlotStatus {
  FREE = 'FREE',
  BOOKED = 'BOOKED',
  BREAK = 'BREAK',
  OFF_SHIFT = 'OFF_SHIFT',
}

export interface SlotInfo extends TimeRange {
  startAt: Date;
  endAt: Date;
  status: SlotStatus;
  appointmentId?: string;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: number;
  isBranchOpen: boolean;
  slots: SlotInfo[];
}

/**
 * Implements the Section 5.1 slot rules: a slot must fall inside the branch's
 * OperatingHour blocks AND the doctor's DoctorShift blocks, must not overlap a
 * DoctorBreak, and must not overlap an existing (non-cancelled) Appointment. The
 * canonical grid always comes from the branch's operating hours so the UI can render
 * every possible slot with a distinct status (Section 5.2) instead of just omitting
 * unavailable ones.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(OperatingHour)
    private readonly operatingHoursRepository: Repository<OperatingHour>,
    @InjectRepository(DoctorShift)
    private readonly doctorShiftsRepository: Repository<DoctorShift>,
    @InjectRepository(DoctorBreak)
    private readonly doctorBreaksRepository: Repository<DoctorBreak>,
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Cached wrapper (Section 3: "caching doctor availability lookups"). A short 20s TTL
   * bounds staleness without needing perfect invalidation coverage; the actual booking
   * write path (AppointmentsService.assertSlotIsFree) always re-validates against
   * Postgres directly inside the transaction, so a stale cache read can at worst show a
   * slot as free for a few seconds after it's taken - it can never cause a double-booking.
   * Writes still proactively call `invalidateDoctorDay` so the common case is fresh.
   */
  async getDoctorDayAvailability(
    doctorId: string,
    branchId: string,
    date: Date,
  ): Promise<DayAvailability> {
    const dateStr = format(date, 'yyyy-MM-dd');
    const cacheKey = this.cacheKey(doctorId, branchId, dateStr);

    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) {
      return this.reviveDates(JSON.parse(cached) as DayAvailability);
    }

    const result = await this.computeDoctorDayAvailability(doctorId, branchId, date, dateStr);
    await this.redis
      .set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS)
      .catch(() => undefined);
    return result;
  }

  /** Called by AppointmentsService after any write that could change this doctor/day's slots. */
  async invalidateDoctorDay(doctorId: string, branchId: string, date: Date): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');
    await this.redis.del(this.cacheKey(doctorId, branchId, dateStr)).catch(() => undefined);
  }

  private cacheKey(doctorId: string, branchId: string, dateStr: string): string {
    return `availability:${branchId}:${doctorId}:${dateStr}`;
  }

  /** JSON round-tripping turns Date fields into strings - restore them for callers that rely on Date methods. */
  private reviveDates(day: DayAvailability): DayAvailability {
    return {
      ...day,
      slots: day.slots.map((slot) => ({
        ...slot,
        startAt: new Date(slot.startAt),
        endAt: new Date(slot.endAt),
      })),
    };
  }

  private async computeDoctorDayAvailability(
    doctorId: string,
    branchId: string,
    date: Date,
    dateStr: string,
  ): Promise<DayAvailability> {
    const dayOfWeek = date.getDay();

    const operatingHours = await this.operatingHoursRepository.find({
      where: { branchId, dayOfWeek },
    });

    if (operatingHours.length === 0) {
      return { date: dateStr, dayOfWeek, isBranchOpen: false, slots: [] };
    }

    const shifts = await this.doctorShiftsRepository.find({
      where: { doctorId, dayOfWeek, active: true },
    });

    const breaks = await this.doctorBreaksRepository.find({
      where: { doctorId, date: dateStr },
    });

    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);
    const appointments = await this.appointmentsRepository.find({
      where: {
        doctorId,
        startAt: Between(dayStart, dayEnd),
      },
    });
    const activeAppointments = appointments.filter((a) =>
      SLOT_BLOCKING_STATUSES.includes(a.status),
    );

    const canonicalSlots = operatingHours.flatMap((block) =>
      generateSlots({ start: block.openTime, end: block.closeTime }),
    );

    const slots: SlotInfo[] = canonicalSlots
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((slot) => {
        const startAt = new Date(`${dateStr}T${slot.start}:00`);
        const endAt = new Date(`${dateStr}T${slot.end}:00`);

        const withinShift = shifts.some((shift) =>
          this.rangeContains({ start: shift.startTime, end: shift.endTime }, slot),
        );
        if (!withinShift) {
          return { ...slot, startAt, endAt, status: SlotStatus.OFF_SHIFT };
        }

        const onBreak = breaks.some((b) =>
          rangesOverlap({ start: b.startTime, end: b.endTime }, slot),
        );
        if (onBreak) {
          return { ...slot, startAt, endAt, status: SlotStatus.BREAK };
        }

        const booked = activeAppointments.find(
          (a) => a.startAt.getTime() < endAt.getTime() && startAt.getTime() < a.endAt.getTime(),
        );
        if (booked) {
          return { ...slot, startAt, endAt, status: SlotStatus.BOOKED, appointmentId: booked.id };
        }

        return { ...slot, startAt, endAt, status: SlotStatus.FREE };
      });

    return { date: dateStr, dayOfWeek, isBranchOpen: true, slots };
  }

  async getDoctorWeekAvailability(
    doctorId: string,
    branchId: string,
    weekStart: Date,
  ): Promise<DayAvailability[]> {
    const days: DayAvailability[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push(await this.getDoctorDayAvailability(doctorId, branchId, date));
    }
    return days;
  }

  /** True when `inner` falls entirely inside `outer` (used for the shift-vs-slot check). */
  private rangeContains(outer: TimeRange, inner: TimeRange): boolean {
    return outer.start <= inner.start && inner.end <= outer.end;
  }
}
