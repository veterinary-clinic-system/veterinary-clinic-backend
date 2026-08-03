import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '@/shared/database/base.entity';
import { Species } from './species.entity';
import { Pet } from './pet.entity';

/** diagram.jpg `Breed` box. */
@Entity({ name: 'breeds' })
export class Breed extends BaseEntity {
  @ManyToOne(() => Species, (species) => species.breeds, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'species_id' })
  species: Species;

  @Column({ name: 'species_id' })
  speciesId: string;

  @Column({ name: 'breed_name', length: 100 })
  breedName: string;

  @OneToMany(() => Pet, (pet) => pet.breed)
  pets?: Pet[];
}
