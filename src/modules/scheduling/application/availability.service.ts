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
  /**
   * Khung gio nam TRUOC thoi diem som nhat con dat duoc (xem `domain/booking-window.ts`).
   * Chi xuat hien o goc nhin cong khai: lich cua nhan vien van phai thay qua khu that
   * su de tra cuu lich su. Tach khoi `OFF_SHIFT` de giao dien noi dung ly do vi sao o
   * do bi khoa.
   */
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

/** Mot o ngay trong che do THANG (FR-05-03) - chi so lieu tong hop, khong co luoi slot. */
export interface MonthDaySummary {
  /** 'yyyy-MM-dd'. */
  date: string;
  dayOfWeek: number;
  isBranchOpen: boolean;
  /** So lich hen con hieu luc (chua bi huy / khach khong den). */
  appointmentCount: number;
  /** So lich da huy hoac khach khong den - de o lich thang khong "mat" chung. */
  closedCount: number;
  /** Mau uu tien NANG NHAT trong ngay; null khi khong lich nao duoc gan mau. */
  topPriorityColor: PriorityColor | null;
}

export interface MonthOverview {
  /** 'yyyy-MM'. */
  month: string;
  days: MonthDaySummary[];
}

/**
 * Do "tot" cua mot trang thai o khi gop luoi cua NHIEU bac si lai lam mot (che do
 * "de phong kham sap xep"): con mot bac si ranh la o do van dat duoc.
 */
const MERGE_PRECEDENCE: SlotStatus[] = [
  SlotStatus.FREE,
  SlotStatus.BOOKED,
  SlotStatus.BREAK,
  SlotStatus.OFF_SHIFT,
  SlotStatus.PAST,
];

/**
 * Gop luoi slot cua nhieu bac si trong cung mot ngay thanh MOT luoi "chi nhanh".
 *
 * Dung cho lua chon "khong chon bac si cu the" o buoc dat lich: khach chi can biet
 * khung gio nao con nguoi kham duoc, con viec ai kham do he thong xep.
 *
 * `appointmentId` bi bo di co y - o goc nhin gop, mot o "da dat" khong ung voi mot lich
 * hen duy nhat nao ca.
 */
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

/**
 * Cac o cua luoi ma khoang [startAt, endAt) chiem, hoac `null` khi khoang do KHONG nam
 * gon tren luoi.
 *
 * Luoi la 30 phut nhung dich vu co the dai hon (vi du "Phau thuat nho" 60 phut), nen
 * mot lich hen thuong an nhieu o lien tiep. Ba dieu kien de coi la "nam gon":
 *   1. Bat dau DUNG mep mot o - khong cho bat dau luc 17:05.
 *   2. Cac o phu lien tuc, khong co khe ho - 10:30 + 60 phut khong duoc phep nhay qua
 *      gio nghi trua 11:00-13:30 roi dem tiep tu 13:30.
 *   3. O cuoi phai cham toi `endAt` - 17:00 + 60 phut vuot qua o cuoi 17:00-17:30 cua
 *      ngay lam viec.
 *
 * Tra ve cac o de nguoi goi tu phan xu trang thai (BOOKED -> 409, BREAK/OFF_SHIFT ->
 * 400); ham nay chi tra loi cau hoi "khoang gio nay co ton tai tren luoi khong".
 */
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

/** Trang thai lich hen van "con hieu luc" - dung cho so dem cua che do thang. */
const ACTIVE_STATUS_LIST = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
]
  .map((status) => `'${status}'`)
  .join(', ');

/** Bang rank cua `PRIORITY_COLOR_SEVERITY`, viet duoi dang SQL. 99 = chua gan mau. */
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

  /**
   * Che do THANG cua lich lam viec (FR-05-03).
   *
   * CO Y khong dung lai `getDoctorDayAvailability`: dung luoi slot 30 phut cho ca thang
   * la ~30 x 20 o cho moi bac si, chi de ve mot con so dem tren moi o lich - vua nang
   * vua lam phinh cache Redis. O day chi can MOT cau lenh gom nhom theo ngay; NFR-02
   * doi che do thang duoi 500ms.
   *
   * `doctorId` tuy chon: bo trong = toan bo chi nhanh (goc nhin cua quan ly), co gia
   * tri = loc theo mot bac si nhu hai che do kia.
   */
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
      // Rank nho hon = nang hon (xem PRIORITY_COLOR_SEVERITY). MIN tren rank chinh la
      // "mau uu tien cao nhat trong ngay"; 99 cho lich chua gan mau de chung khong
      // thang MIN. Chi tinh tren lich CON HIEU LUC - neu khong, mot ngay ma moi ca deu
      // da huy van hien nhan "Do - Cap cuu" tren o lich thang.
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

    // Ngay chi nhanh mo cua chi phu thuoc thu trong tuan - mot truy van cho ca thang.
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

  /** True when `inner` falls entirely inside `outer` (used for the shift-vs-slot check). */
  private rangeContains(outer: TimeRange, inner: TimeRange): boolean {
    return outer.start <= inner.start && inner.end <= outer.end;
  }
}
