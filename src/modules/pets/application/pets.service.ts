import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { CreatePetDto } from '@/modules/pets/presentation/dto/create-pet.dto';
import { UpdatePetDto } from '@/modules/pets/presentation/dto/update-pet.dto';
import { QueryPetsDto } from '@/modules/pets/presentation/dto/query-pets.dto';

const PET_DETAIL_RELATIONS = ['owner', 'breed', 'breed.species'];
const PET_SORTABLE_COLUMNS = new Set(['name', 'createdAt', 'updatedAt', 'weight']);

@Injectable()
export class PetsService {
  constructor(
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Breed) private readonly breedsRepository: Repository<Breed>,
    @InjectRepository(Appointment) private readonly appointmentsRepository: Repository<Appointment>,
  ) {}

  /** Staff adding a pet profile to an existing owner outside the booking flow (Section 4.1.1). */
  async create(dto: CreatePetDto): Promise<Pet> {
    const owner = await this.usersRepository.findOne({ where: { id: dto.ownerId } });
    if (!owner) {
      throw new BadRequestException('Owner not found');
    }

    const breed = await this.breedsRepository.findOne({ where: { id: dto.breedId } });
    if (!breed) {
      throw new BadRequestException('Breed not found');
    }

    const pet = this.petsRepository.create({
      name: dto.name,
      breedId: dto.breedId,
      gender: dto.gender,
      weight: dto.weight ?? null,
      birthDate: dto.birthDate ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      notes: dto.notes ?? null,
      allergies: dto.allergies ?? [],
      chronicConditions: dto.chronicConditions ?? [],
      ownerId: dto.ownerId,
    });
    const saved = await this.petsRepository.save(pet);
    return this.loadPetOrThrow(saved.id);
  }

  async update(id: string, dto: UpdatePetDto): Promise<Pet> {
    const pet = await this.petsRepository.findOne({ where: { id } });
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    if (dto.ownerId !== undefined && dto.ownerId !== pet.ownerId) {
      const owner = await this.usersRepository.findOne({ where: { id: dto.ownerId } });
      if (!owner) {
        throw new BadRequestException('Owner not found');
      }
    }

    if (dto.breedId !== undefined && dto.breedId !== pet.breedId) {
      const breed = await this.breedsRepository.findOne({ where: { id: dto.breedId } });
      if (!breed) {
        throw new BadRequestException('Breed not found');
      }
    }

    // A raw partial UPDATE (rather than mutate-then-save the relation-hydrated entity)
    // so a reassigned breedId/ownerId can't be shadowed by the stale `breed`/`owner`
    // relation objects - same convention as AppointmentsService.update() for doctorId.
    await this.petsRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.breedId !== undefined ? { breedId: dto.breedId } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
      ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
      ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate } : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.allergies !== undefined ? { allergies: dto.allergies } : {}),
      ...(dto.chronicConditions !== undefined ? { chronicConditions: dto.chronicConditions } : {}),
      ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
    });

    return this.loadPetOrThrow(id);
  }

  /** Full staff view - no ownership check. Used internally and by the staff-only `findOne` path. */
  async findOne(id: string): Promise<Pet> {
    return this.loadPetOrThrow(id);
  }

  /**
   * Shared by `GET /pets/:id` and `GET /pets/:id/timeline`, neither of which carries
   * `@Roles(...)`: staff roles always pass, a PetOwner only passes for their own pet.
   */
  async findOneForActor(id: string, actor: AuthenticatedUser): Promise<Pet> {
    const pet = await this.loadPetOrThrow(id);
    if (actor.role === Role.PET_OWNER && pet.ownerId !== actor.userId) {
      throw new ForbiddenException("You can only view your own pet's profile");
    }
    return pet;
  }

  async findMine(actor: AuthenticatedUser): Promise<Pet[]> {
    return this.petsRepository.find({
      where: { ownerId: actor.userId },
      relations: ['breed', 'breed.species'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Paginated staff search backing "Search profiles by name, phone number, or record ID" (Section 4.1.1). */
  async findAll(query: QueryPetsDto): Promise<PaginatedResultDto<Pet>> {
    const qb = this.petsRepository
      .createQueryBuilder('pet')
      .leftJoinAndSelect('pet.owner', 'owner')
      .leftJoinAndSelect('pet.breed', 'breed')
      .leftJoinAndSelect('breed.species', 'species');

    if (query.ownerId) {
      qb.andWhere('pet.ownerId = :ownerId', { ownerId: query.ownerId });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('pet.name ILIKE :search', { search: `%${search}%` })
            .orWhere('owner.phone ILIKE :search', {
              search: `%${search}%`,
            });
          // Only add the exact-id branch when `search` is actually a UUID - a raw
          // non-UUID string in a `uuid = :param` comparison throws a Postgres error.
          if (isUUID(search)) {
            sub.orWhere('pet.id = :exactId', { exactId: search });
          }
        }),
      );
    }

    // sortBy is caller-controlled input - never interpolate it unchecked into raw SQL.
    const sortBy =
      query.sortBy && PET_SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`pet.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /**
   * Section 4.1.4 "timeline view of examination history": this pet's appointments,
   * most recent first, each with its linked Examination (diagnosis/vitals/attachments)
   * when one exists.
   */
  async getTimeline(id: string, actor: AuthenticatedUser): Promise<Appointment[]> {
    await this.findOneForActor(id, actor); // 404s / 403s before touching the appointments table

    return this.appointmentsRepository.find({
      where: { petId: id },
      relations: ['doctor', 'examination'],
      order: { startAt: 'DESC' },
    });
  }

  private async loadPetOrThrow(id: string): Promise<Pet> {
    const pet = await this.petsRepository.findOne({
      where: { id },
      relations: PET_DETAIL_RELATIONS,
    });
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    return pet;
  }
}
