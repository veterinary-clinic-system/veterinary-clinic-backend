import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Breed, Species } from '@/database/entities';
import { CreateBreedDto } from './dto/create-breed.dto';
import { CreateSpeciesDto } from './dto/create-species.dto';

/** Species/Breed are the two-level reference catalog backing the pet-creation form's dropdowns. */
@Injectable()
export class SpeciesService {
  constructor(
    @InjectRepository(Species) private readonly speciesRepository: Repository<Species>,
    @InjectRepository(Breed) private readonly breedsRepository: Repository<Breed>,
  ) {}

  /** Breeds eager-loaded so the web app can build the dependent Species -> Breed dropdown pair. */
  async findAll(): Promise<Species[]> {
    return this.speciesRepository.find({
      relations: ['breeds'],
      order: { speciesName: 'ASC' },
    });
  }

  async create(dto: CreateSpeciesDto): Promise<Species> {
    const existing = await this.speciesRepository.findOne({ where: { speciesName: dto.speciesName } });
    if (existing) {
      throw new ConflictException('This species already exists');
    }
    return this.speciesRepository.save(this.speciesRepository.create({ speciesName: dto.speciesName }));
  }

  async findBreeds(speciesId: string): Promise<Breed[]> {
    await this.findSpeciesOrThrow(speciesId);
    return this.breedsRepository.find({ where: { speciesId }, order: { breedName: 'ASC' } });
  }

  async createBreed(speciesId: string, dto: CreateBreedDto): Promise<Breed> {
    await this.findSpeciesOrThrow(speciesId);

    const existing = await this.breedsRepository.findOne({ where: { speciesId, breedName: dto.breedName } });
    if (existing) {
      throw new ConflictException('This breed already exists for this species');
    }

    return this.breedsRepository.save(this.breedsRepository.create({ speciesId, breedName: dto.breedName }));
  }

  private async findSpeciesOrThrow(id: string): Promise<Species> {
    const species = await this.speciesRepository.findOne({ where: { id } });
    if (!species) {
      throw new NotFoundException('Species not found');
    }
    return species;
  }
}
