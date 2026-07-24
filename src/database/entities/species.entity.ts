import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Breed } from './breed.entity';

/** diagram.jpg `Species` box. */
@Entity({ name: 'species' })
export class Species extends BaseEntity {
  @Column({ name: 'species_name', length: 100, unique: true })
  speciesName: string;

  @OneToMany(() => Breed, (breed) => breed.species)
  breeds?: Breed[];
}
