import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { OperatingHour } from './operating-hour.entity';
import { Doctor } from './doctor.entity';

/** diagram.jpg `Branch` box. */
@Entity({ name: 'branches' })
export class Branch extends BaseEntity {
  @Column({ name: 'branch_name', length: 255 })
  branchName: string;

  @Column({ name: 'phone', length: 20 })
  phone: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'address', type: 'text' })
  address: string;

  @Column({ name: 'active', default: true })
  active: boolean;

  @OneToMany(() => OperatingHour, (hour) => hour.branch, { cascade: true })
  openingHours?: OperatingHour[];

  @OneToMany(() => Doctor, (doctor) => doctor.branch)
  doctors?: Doctor[];
}
