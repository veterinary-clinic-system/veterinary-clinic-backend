import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Vaccine } from '@/modules/catalog/domain/entities/vaccine.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateVaccineDto } from '@/modules/catalog/presentation/dto/create-vaccine.dto';
import { UpdateVaccineDto } from '@/modules/catalog/presentation/dto/update-vaccine.dto';
import { QueryVaccinesDto } from '@/modules/catalog/presentation/dto/query-vaccines.dto';

const ITEM_SORT_COLUMNS = new Set(['itemName', 'unitPrice']);
const VACCINE_SORT_COLUMNS = new Set(['diseasePrevented', 'createdAt', 'updatedAt']);
const DETAIL_RELATIONS = ['item', 'item.category', 'supplier', 'speciesApplicable'];

/**
 * Danh muc vaccine - SRS FR-12 (P9-T1).
 *
 * Cung khuon voi `MedicationsService`/`ProductsService`: mot dong `items` (mang gia va
 * ma nghiep vu) + mot dong `vaccines` (mang phac do), tao trong CUNG transaction. Nho
 * the vaccine di thang vao kho, POS va hoa don ma khong doan nao phai biet no la
 * vaccine.
 */
@Injectable()
export class VaccinesService {
  constructor(
    @InjectRepository(Vaccine) private readonly vaccinesRepository: Repository<Vaccine>,
    @InjectRepository(Pet) private readonly petsRepository: Repository<Pet>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateVaccineDto): Promise<Vaccine> {
    this.assertScheduleCoherent(dto.doseCount ?? 1, dto.intervalDays ?? null);

    const vaccineId = await this.dataSource.transaction(async (manager) => {
      const species = await this.resolveSpecies(manager, dto.speciesIds);

      const item = await manager.save(
        manager.create(Item, {
          itemName: dto.itemName,
          describe: dto.describe ?? null,
          itemType: ItemType.VACCINE,
          unitPrice: dto.unitPrice,
          categoryId: dto.categoryId ?? null,
          active: true,
        }),
      );

      const vaccine = await manager.save(
        manager.create(Vaccine, {
          itemId: item.id,
          diseasePrevented: dto.diseasePrevented,
          doseCount: dto.doseCount ?? 1,
          intervalDays: dto.intervalDays ?? null,
          boosterIntervalDays: dto.boosterIntervalDays ?? null,
          manufacturer: dto.manufacturer ?? null,
          supplierId: dto.supplierId ?? null,
          costPrice: dto.costPrice ?? 0,
          minimumStock: dto.minimumStock ?? 0,
          speciesApplicable: species,
          active: true,
        }),
      );

      return vaccine.id;
    });

    return this.findOne(vaccineId);
  }

  /**
   * Danh sach vaccine, loc duoc theo loai - acceptance P9-T1.
   *
   * Dieu kien loc la "khai dich danh loai nay HOAC khong khai loai nao": vaccine dung
   * cho moi loai (dai) khong khai dong nao trong `vaccine_species`, va no phai hien ra
   * khi bac si dang kham cho. Xem `QueryVaccinesDto`.
   */
  async findAll(query: QueryVaccinesDto): Promise<PaginatedResultDto<Vaccine>> {
    const speciesId = await this.resolveSpeciesFilter(query);

    const qb = this.vaccinesRepository
      .createQueryBuilder('vaccine')
      .leftJoinAndSelect('vaccine.item', 'item')
      .leftJoinAndSelect('item.category', 'category')
      .leftJoinAndSelect('vaccine.supplier', 'supplier')
      .leftJoinAndSelect('vaccine.speciesApplicable', 'species');

    qb.andWhere('vaccine.active = :active', { active: query.active ?? true });

    if (speciesId) {
      qb.andWhere(
        `(
           EXISTS (
             SELECT 1 FROM "vaccine_species" vs
              WHERE vs."vaccine_id" = vaccine.id AND vs."species_id" = :speciesId
           )
           OR NOT EXISTS (
             SELECT 1 FROM "vaccine_species" vs WHERE vs."vaccine_id" = vaccine.id
           )
         )`,
        { speciesId },
      );
    }

    const requestedSort = query.sortBy;
    const sortColumn = ITEM_SORT_COLUMNS.has(requestedSort ?? '')
      ? `item.${requestedSort}`
      : VACCINE_SORT_COLUMNS.has(requestedSort ?? '')
        ? `vaccine.${requestedSort}`
        : 'item.itemName';

    qb.orderBy(sortColumn, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Vaccine> {
    const vaccine = await this.vaccinesRepository.findOne({
      where: { id },
      relations: DETAIL_RELATIONS,
    });
    if (!vaccine) {
      throw new NotFoundException('Vaccine not found');
    }
    return vaccine;
  }

  async update(id: string, dto: UpdateVaccineDto): Promise<Vaccine> {
    const vaccine = await this.findOne(id);
    this.assertScheduleCoherent(
      dto.doseCount ?? vaccine.doseCount,
      dto.intervalDays !== undefined ? dto.intervalDays : vaccine.intervalDays,
    );

    await this.dataSource.transaction(async (manager) => {
      // `Pick` chu khong `Partial<Item>` - xem ghi chu trong `medications.service.ts`.
      const itemUpdates: Partial<
        Pick<Item, 'itemName' | 'describe' | 'unitPrice' | 'categoryId' | 'active'>
      > = {};
      if (dto.itemName !== undefined) itemUpdates.itemName = dto.itemName;
      if (dto.describe !== undefined) itemUpdates.describe = dto.describe;
      if (dto.unitPrice !== undefined) itemUpdates.unitPrice = dto.unitPrice;
      if (dto.categoryId !== undefined) itemUpdates.categoryId = dto.categoryId;
      if (dto.active !== undefined) itemUpdates.active = dto.active;
      if (Object.keys(itemUpdates).length > 0) {
        await manager.update(Item, vaccine.itemId, itemUpdates);
      }

      const vaccineUpdates: Partial<
        Pick<
          Vaccine,
          | 'diseasePrevented'
          | 'doseCount'
          | 'intervalDays'
          | 'boosterIntervalDays'
          | 'manufacturer'
          | 'supplierId'
          | 'costPrice'
          | 'minimumStock'
          | 'active'
        >
      > = {};
      if (dto.diseasePrevented !== undefined)
        vaccineUpdates.diseasePrevented = dto.diseasePrevented;
      if (dto.doseCount !== undefined) vaccineUpdates.doseCount = dto.doseCount;
      if (dto.intervalDays !== undefined) vaccineUpdates.intervalDays = dto.intervalDays;
      if (dto.boosterIntervalDays !== undefined)
        vaccineUpdates.boosterIntervalDays = dto.boosterIntervalDays;
      if (dto.manufacturer !== undefined) vaccineUpdates.manufacturer = dto.manufacturer;
      if (dto.supplierId !== undefined) vaccineUpdates.supplierId = dto.supplierId;
      if (dto.costPrice !== undefined) vaccineUpdates.costPrice = dto.costPrice;
      if (dto.minimumStock !== undefined) vaccineUpdates.minimumStock = dto.minimumStock;
      if (dto.active !== undefined) vaccineUpdates.active = dto.active;
      if (Object.keys(vaccineUpdates).length > 0) {
        await manager.update(Vaccine, id, vaccineUpdates);
      }

      if (dto.speciesIds !== undefined) {
        // Danh sach loai la THAY THE toan bo. `save` tren entity co quan he ManyToMany
        // la cach duy nhat TypeORM dong bo bang noi - `manager.update` bo qua quan he.
        const species = await this.resolveSpecies(manager, dto.speciesIds);
        const entity = await manager.findOneOrFail(Vaccine, {
          where: { id },
          relations: ['speciesApplicable'],
        });
        entity.speciesApplicable = species;
        await manager.save(entity);
      }
    });

    return this.findOne(id);
  }

  // ------------------------------------------------------------------ Ben trong

  /**
   * Phac do nhieu mui ma khong co khoang cach giua cac mui la mot ho so khong dung
   * duoc: `VaccinationsService` se khong tinh noi `nextDueDate` cho mui thu hai, va
   * loi do chi lo ra vao luc bac si dang tiem.
   */
  private assertScheduleCoherent(doseCount: number, intervalDays: number | null): void {
    if (doseCount > 1 && !intervalDays) {
      throw new BadRequestException(
        'Phac do nhieu hon mot mui phai khai `intervalDays` (khoang cach giua cac mui)',
      );
    }
  }

  /** `petId` tien hon cho man hinh kham; quy ve `speciesId` de chi co mot duong loc. */
  private async resolveSpeciesFilter(query: QueryVaccinesDto): Promise<string | undefined> {
    if (query.speciesId) {
      return query.speciesId;
    }
    if (!query.petId) {
      return undefined;
    }
    const pet = await this.petsRepository.findOne({
      where: { id: query.petId },
      relations: ['breed'],
    });
    if (!pet) {
      throw new NotFoundException('Pet not found');
    }
    return pet.breed?.speciesId;
  }

  private async resolveSpecies(
    manager: EntityManager,
    speciesIds: string[] | undefined,
  ): Promise<Species[]> {
    const ids = [...new Set(speciesIds ?? [])];
    if (ids.length === 0) {
      return [];
    }
    const species = await manager.find(Species, { where: { id: In(ids) } });
    if (species.length !== ids.length) {
      const found = new Set(species.map((s) => s.id));
      const missing = ids.filter((id) => !found.has(id));
      throw new BadRequestException(`Species not found: ${missing.join(', ')}`);
    }
    return species;
  }
}
