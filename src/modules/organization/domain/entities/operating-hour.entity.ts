import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Branch } from './branch.entity';

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

  @Column({ name: 'open_time', length: 5 })
  openTime: string;

  @Column({ name: 'close_time', length: 5 })
  closeTime: string;
}
