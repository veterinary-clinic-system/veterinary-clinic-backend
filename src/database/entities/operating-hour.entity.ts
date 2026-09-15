import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Branch } from './branch.entity';

/**
 * diagram.jpg `OperatingHour` box. One row per (branch, dayOfWeek, block) so a branch
 * can express the two daily blocks from Section 5.1 (07:00-11:00 and 13:30-17:30) and,
 * in principle, per-branch overrides. `dayOfWeek` follows JS `Date#getDay()`: 0 (Sunday)
 * - 6 (Saturday). Section 5.1 mandates Saturday/Sunday are closed, so the seed never
 * inserts rows for 0 or 6.
 */
@Entity({ name: 'operating_hours' })
@Index(['branch', 'dayOfWeek'])
export class OperatingHour extends BaseEntity {
  @ManyToOne(() => Branch, (branch) => branch.openingHours, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @Column({ name: 'branch_id' })
  branchId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  /** 24h "HH:mm" format, e.g. "07:00". */
  @Column({ name: 'open_time', length: 5 })
  openTime: string;

  @Column({ name: 'close_time', length: 5 })
  closeTime: string;
}
