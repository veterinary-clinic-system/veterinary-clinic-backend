import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Breed } from './breed.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Gender } from '@/shared/common/enums/gender.enum';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';

/** diagram.jpg `Pet` box. */
@Entity({ name: 'pets' })
export class Pet extends BaseEntity {
  @Column({ name: 'name', length: 255 })
  name: string;

  @ManyToOne(() => Breed, (breed) => breed.pets, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'breed_id' })
  breed: Breed;

  @Column({ name: 'breed_id' })
  breedId: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.ASEXUAL })
  gender: Gender;

  @Column({ name: 'weight', type: 'numeric', precision: 6, scale: 2, nullable: true })
  weight: number | null;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /**
   * Not itemized in diagram.jpg's attribute list but required by prompt.md Section
   * 4.1.1 ("Flag special info: drug allergies, chronic conditions"). Kept as free-text
   * arrays rather than a fixed enum since allergy/condition text is open-ended.
   */
  @Column({ name: 'allergies', type: 'text', array: true, default: [] })
  allergies: string[];

  @Column({ name: 'chronic_conditions', type: 'text', array: true, default: [] })
  chronicConditions: string[];

  @ManyToOne(() => User, (user) => user.pets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @OneToMany(() => Appointment, (appointment) => appointment.pet)
  appointments?: Appointment[];
}
