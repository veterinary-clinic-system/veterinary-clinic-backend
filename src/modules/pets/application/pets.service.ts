import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { assertCustomerCanOwnPets } from '@/modules/identity/domain/entities/customer-status';
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
    await assertOwnerIsActive(this.usersRepository, dto.ownerId);
    await this.assertBreedBelongsToSpecies(dto.breedId, dto.speciesId);

    const microchipId = normalizeMicrochipId(dto.microchipId);
    if (microchipId) {
      await this.assertMicrochipIsFree(microchipId, null);
    }

    const pet = this.petsRepository.create({
      name: dto.name,
      breedId: dto.breedId,
      gender: dto.gender,
      weight: dto.weight ?? null,
      birthDate: dto.birthDate ?? null,
      microchipId,
      color: dto.color ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      notes: dto.notes ?? null,
      allergies: dto.allergies ?? [],
      chronicConditions: dto.chronicConditions ?? [],
      ownerId: dto.ownerId,
    });
    const saved = await mapMicrochipConflict(() => this.petsRepository.save(pet));
    return this.loadPetOrThrow(saved.id);
  }

  async update(id: string, dto: UpdatePetDto): Promise<Pet> {
    const pet = await this.petsRepository.findOne({ where: { id } });
    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng');
    }

    // BR-02 chi chan viec CHUYEN sang mot chu nuoi da ngung hoat dong. Sua ten/can nang
    // cua thu cung dang thuoc mot khach ngung hoat dong van phai lam duoc - khoa lai se
    // khoa luon ca ho so cu.
    if (dto.ownerId !== undefined && dto.ownerId !== pet.ownerId) {
      await assertOwnerIsActive(this.usersRepository, dto.ownerId);
    }

    if (dto.breedId !== undefined || dto.speciesId !== undefined) {
      await this.assertBreedBelongsToSpecies(dto.breedId ?? pet.breedId, dto.speciesId);
    }

    const microchipId =
      dto.microchipId !== undefined ? normalizeMicrochipId(dto.microchipId) : undefined;
    if (microchipId) {
      await this.assertMicrochipIsFree(microchipId, id);
    }

    // A raw partial UPDATE (rather than mutate-then-save the relation-hydrated entity)
    // so a reassigned breedId/ownerId can't be shadowed by the stale `breed`/`owner`
    // relation objects - same convention as AppointmentsService.update() for doctorId.
    await mapMicrochipConflict(() =>
      this.petsRepository.update(id, {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.breedId !== undefined ? { breedId: dto.breedId } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: dto.birthDate } : {}),
        ...(microchipId !== undefined ? { microchipId } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.allergies !== undefined ? { allergies: dto.allergies } : {}),
        ...(dto.chronicConditions !== undefined
          ? { chronicConditions: dto.chronicConditions }
          : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      }),
    );

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
            })
            // Ma nghiep vu (FR-04-01) va so microchip - hai thu le tan doc duoc tren
            // giay to cua khach, khac voi UUID.
            .orWhere('pet.petCode ILIKE :search', { search: `%${search}%` })
            .orWhere('pet.microchipId ILIKE :search', { search: `%${search}%` });
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
   * Section 4.1.4 "timeline view of examination history": this pet's appointments, most
   * recent first, each with its linked Examination (vitals) and MedicalRecord when one
   * exists.
   *
   * Tu P4-T8, chan doan doc tu `medicalRecord.diagnoses` chu khong con tu
   * `examination.diseaseGroups`. Van tra ve `Appointment[]` chu khong phai
   * `MedicalRecord[]`: day la route CHU THU CUNG tu xem (`GET /pets/:id/timeline`), noi
   * mot lich hen chua kham xong van phai hien ra - `MedicalRecordsService.getTimelineForPet`
   * moi la benh su cua nhan vien, va no chi thay nhung lan da mo ho so.
   */
  async getTimeline(id: string, actor: AuthenticatedUser): Promise<Appointment[]> {
    await this.findOneForActor(id, actor); // 404s / 403s before touching the appointments table

    return this.appointmentsRepository.find({
      where: { petId: id },
      relations: [
        'doctor',
        'examination',
        'medicalRecord',
        'medicalRecord.diagnoses',
        'medicalRecord.treatments',
      ],
      order: { startAt: 'DESC' },
    });
  }

  private async loadPetOrThrow(id: string): Promise<Pet> {
    const pet = await this.petsRepository.findOne({
      where: { id },
      relations: PET_DETAIL_RELATIONS,
    });
    if (!pet) {
      throw new NotFoundException('Không tìm thấy thú cưng');
    }
    return pet;
  }

  /**
   * Muc 16 SRS: loai la truong bat buoc. Giong da chon phai THUOC loai do - neu khong,
   * mot bieu mau doi loai sang "Mèo" nhung con giu lai giong "Poodle" cua lan chon
   * truoc se tao ra mot ho so tu mau thuan.
   */
  private async assertBreedBelongsToSpecies(breedId: string, speciesId?: string): Promise<Breed> {
    const breed = await this.breedsRepository.findOne({ where: { id: breedId } });
    if (!breed) {
      throw new BadRequestException('Không tìm thấy giống thú cưng đã chọn');
    }
    if (speciesId && breed.speciesId !== speciesId) {
      throw new BadRequestException('Giống đã chọn không thuộc loài đã chọn');
    }
    return breed;
  }

  /**
   * Mot so microchip chi duoc gan cho mot thu cung. Kiem o day de le tan nhan duoc
   * thong bao co ten con vat dang giu so do; chi muc `uq_pets_microchip_id` van la
   * thu chot chan (xem `mapMicrochipConflict`).
   */
  private async assertMicrochipIsFree(
    microchipId: string,
    excludePetId: string | null,
  ): Promise<void> {
    const existing = await this.petsRepository.findOne({
      where: excludePetId ? { microchipId, id: Not(excludePetId) } : { microchipId },
    });
    if (existing) {
      throw new ConflictException(
        `Số microchip "${microchipId}" đã được gắn cho thú cưng "${existing.name}" (${existing.petCode}).`,
      );
    }
  }
}

/** Ma loi PostgreSQL cho vi pham rang buoc UNIQUE. */
const PG_UNIQUE_VIOLATION = '23505';

/** O trong tren giao dien gui len chuoi rong - phai thanh NULL de khong dinh unique. */
function normalizeMicrochipId(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Doi vi pham `uq_pets_microchip_id` cua CSDL thanh 409 co thong bao tieng Viet.
 *
 * Van can du da kiem truoc bang `assertMicrochipIsFree`: giua luc doc va luc ghi, mot
 * request khac co the da chiem so chip do. Cung ly do voi
 * `mapAppointmentOverlapError` ben scheduling.
 */
async function mapMicrochipConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const candidate = error as { code?: string; constraint?: string } | null;
    if (
      candidate?.code === PG_UNIQUE_VIOLATION &&
      candidate?.constraint === 'uq_pets_microchip_id'
    ) {
      throw new ConflictException('Số microchip này vừa được gắn cho một thú cưng khác');
    }
    throw error;
  }
}

/** BR-02 tai cua "them/chuyen thu cung" - xem `assertCustomerCanOwnPets`. */
async function assertOwnerIsActive(
  usersRepository: Repository<User>,
  ownerId: string,
): Promise<User> {
  const owner = await usersRepository.findOne({ where: { id: ownerId } });
  return assertCustomerCanOwnPets(owner);
}
