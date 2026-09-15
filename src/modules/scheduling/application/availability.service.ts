import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { addDays, addMonths, format, startOfMonth } from 'date-fns';
import type Redis from 'ioredis';
import { OperatingHour } from '@/modules/organization/domain/entities/operating-hour.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import {
  AppointmentStatus,
  SLOT_BLOCKING_STATUSES,
} from '@/shared/common/enums/appointment-status.enum';
import { PRIORITY_COLOR_SEVERITY, PriorityColor } from '@/shared/common/enums/priority-color.enum';
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
    PAST = 'PAST',
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

export interface MonthDaySummary {
    date: string;
  dayOfWeek: number;
  isBranchOpen: boolean;
    appointmentCount: number;
    closedCount: number;
    topPriorityColor: PriorityColor | null;
}

export interface MonthOverview {
    month: string;
  days: MonthDaySummary[];
}

const MERGE_PRECEDENCE: SlotStatus[] = [
  SlotStatus.FREE,
  SlotStatus.BOOKED,
  SlotStatus.BREAK,
  SlotStatus.OFF_SHIFT,
  SlotStatus.PAST,
];

export function mergeDoctorDays(days: DayAvailability[]): DayAvailability | null {
  if (days.length === 0) return null;

  const byStart = new Map<string, SlotInfo>();
  for (const day of days) {
    for (const slot of day.slots) {
      const current = byStart.get(slot.start);
      const better =
        !current ||
        MERGE_PRECEDENCE.indexOf(slot.status) < MERGE_PRECEDENCE.indexOf(current.status);
      if (better) {
        byStart.set(slot.start, {
          start: slot.start,
          end: slot.end,
          startAt: slot.startAt,
          endAt: slot.endAt,
          status: slot.status,
        });
      }
    }
  }

  return {
    date: days[0].date,
    dayOfWeek: days[0].dayOfWeek,
    isBranchOpen: days.some((day) => day.isBranchOpen),
    slots: [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start)),
  };
}

export function slotsCovering(
  slots: SlotInfo[],
  startAt: Date,
  endAt: Date,
): SlotInfo[] | null {
  const covered = slots
    .filter(
      (slot) =>
        slot.startAt.getTime() < endAt.getTime() && startAt.getTime() < slot.endAt.getTime(),
    )
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  if (covered.length === 0) return null;
  if (covered[0].startAt.getTime() !== startAt.getTime()) return null;
  if (covered[covered.length - 1].endAt.getTime() < endAt.getTime()) return null;
  for (let i = 1; i < covered.length; i++) {
    if (covered[i].startAt.getTime() !== covered[i - 1].endAt.getTime()) return null;
  }

  return covered;
}

const ACTIVE_STATUS_LIST = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
]
  .map((status) => `'${status}'`)
  .join(', ');

const PRIORITY_RANK_SQL = `CASE appointment.priority_color
    ${Object.entries(PRIORITY_COLOR_SEVERITY)
      .map(([color, rank]) => `WHEN '${color}' THEN ${rank}`)
      .join('\n    ')}
    ELSE 99
  END`;

const RANK_TO_PRIORITY_COLOR = new Map<number, PriorityColor>(
  Object.entries(PRIORITY_COLOR_SEVERITY).map(([color, rank]) => [rank, color as PriorityColor]),
);

function rankToPriorityColor(rank: string | number | null | undefined): PriorityColor | null {
  if (rank === null || rank === undefined) return null;
  return RANK_TO_PRIORITY_COLOR.get(Number(rank)) ?? null;
}

interface RawMonthDayRow {
  date: string;
  active_count: string;
  closed_count: string;
  top_priority_rank: string | null;
}

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

    async invalidateDoctorDay(doctorId: string, branchId: string, date: Date): Promise<void> {
    const dateStr = format(date, 'yyyy-MM-dd');
    await this.redis.del(this.cacheKey(doctorId, branchId, dateStr)).catch(() => undefined);
  }

  private cacheKey(doctorId: string, branchId: string, dateStr: string): string {
    return `availability:${branchId}:${doctorId}:${dateStr}`;
  }

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

    async getMonthOverview(
    branchId: string,
    doctorId: string | undefined,
    monthOf: Date,
  ): Promise<MonthOverview> {
    const monthStart = startOfMonth(monthOf);
    const monthEnd = addMonths(monthStart, 1);

    const qb = this.appointmentsRepository
      .createQueryBuilder('appointment')
      .select("TO_CHAR(appointment.start_at, 'YYYY-MM-DD')", 'date')
      .addSelect(
        `COUNT(*) FILTER (WHERE appointment.status IN (${ACTIVE_STATUS_LIST}))`,
        'active_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE appointment.status NOT IN (${ACTIVE_STATUS_LIST}))`,
        'closed_count',
      )
      .addSelect(
        `MIN(CASE WHEN appointment.status IN (${ACTIVE_STATUS_LIST}) THEN ${PRIORITY_RANK_SQL} END)`,
        'top_priority_rank',
      )
      .where('appointment.branchId = :branchId', { branchId })
      .andWhere('appointment.startAt >= :monthStart AND appointment.startAt < :monthEnd', {
        monthStart,
        monthEnd,
      })
      .groupBy("TO_CHAR(appointment.start_at, 'YYYY-MM-DD')");

    if (doctorId) {
      qb.andWhere('appointment.doctorId = :doctorId', { doctorId });
    }

    const rows = await qb.getRawMany<RawMonthDayRow>();
    const byDate = new Map(rows.map((row) => [row.date, row]));
    const operatingHours = await this.operatingHoursRepository.find({ where: { branchId } });
    const openDaysOfWeek = new Set(operatingHours.map((hour) => hour.dayOfWeek));

    const days: MonthDaySummary[] = [];
    for (let cursor = monthStart; cursor < monthEnd; cursor = addDays(cursor, 1)) {
      const dateStr = format(cursor, 'yyyy-MM-dd');
      const row = byDate.get(dateStr);
      days.push({
        date: dateStr,
        dayOfWeek: cursor.getDay(),
        isBranchOpen: openDaysOfWeek.has(cursor.getDay()),
        appointmentCount: Number(row?.active_count ?? 0),
        closedCount: Number(row?.closed_count ?? 0),
        topPriorityColor: rankToPriorityColor(row?.top_priority_rank),
      });
    }

    return { month: format(monthStart, 'yyyy-MM'), days };
  }

    private rangeContains(outer: TimeRange, inner: TimeRange): boolean {
    return outer.start <= inner.start && inner.end <= outer.end;
  }
}
