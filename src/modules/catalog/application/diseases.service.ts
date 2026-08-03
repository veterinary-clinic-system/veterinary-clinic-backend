import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { CreateDiseaseDto } from '@/modules/catalog/presentation/dto/create-disease.dto';
import { UpdateDiseaseDto } from '@/modules/catalog/presentation/dto/update-disease.dto';
import { QueryDiseasesDto } from '@/modules/catalog/presentation/dto/query-diseases.dto';

const SORTABLE_COLUMNS = new Set(['diseaseName', 'createdAt', 'updatedAt']);
/** Postgres unique_violation error code. */
const UNIQUE_VIOLATION = '23505';

/**
 * Admin CRUD for the Disease catalog. The prescreening module (owned by another agent)
 * also auto-creates Disease rows on the fly by name when its AI service returns a
 * disease-group name that doesn't exist yet - that's expected; this service is not the
 * only writer of this table, which is why `create()`/`update()` defend against a
 * concurrent unique-name insert as well as pre-checking it.
 */
@Injectable()
export class DiseasesService {
  constructor(
    @InjectRepository(Disease) private readonly diseasesRepository: Repository<Disease>,
  ) {}

  async findAll(query: QueryDiseasesDto): Promise<PaginatedResultDto<Disease>> {
    const qb = this.diseasesRepository.createQueryBuilder('disease');

    if (query.search) {
      qb.andWhere('disease.diseaseName ILIKE :search', { search: `%${query.search}%` });
    }

    const sortBy =
      query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'diseaseName';
    qb.orderBy(`disease.${sortBy}`, query.sortOrder ?? 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  async findOne(id: string): Promise<Disease> {
    const disease = await this.diseasesRepository.findOne({ where: { id } });
    if (!disease) {
      throw new NotFoundException('Disease not found');
    }
    return disease;
  }

  async create(dto: CreateDiseaseDto): Promise<Disease> {
    const existing = await this.diseasesRepository.findOne({
      where: { diseaseName: dto.diseaseName },
    });
    if (existing) {
      throw new ConflictException('A disease with this name already exists');
    }

    try {
      const disease = this.diseasesRepository.create({
        diseaseName: dto.diseaseName,
        commonSymptoms: dto.commonSymptoms ?? [],
        otherSymptoms: dto.otherSymptoms ?? null,
      });
      return await this.diseasesRepository.save(disease);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('A disease with this name already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDiseaseDto): Promise<Disease> {
    const disease = await this.findOne(id);

    if (dto.diseaseName !== undefined && dto.diseaseName !== disease.diseaseName) {
      const existing = await this.diseasesRepository.findOne({
        where: { diseaseName: dto.diseaseName, id: Not(id) },
      });
      if (existing) {
        throw new ConflictException('A disease with this name already exists');
      }
      disease.diseaseName = dto.diseaseName;
    }
    if (dto.commonSymptoms !== undefined) disease.commonSymptoms = dto.commonSymptoms;
    if (dto.otherSymptoms !== undefined) disease.otherSymptoms = dto.otherSymptoms;

    try {
      return await this.diseasesRepository.save(disease);
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('A disease with this name already exists');
      }
      throw err;
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as unknown as { driverError?: { code?: string } }).driverError?.code === UNIQUE_VIOLATION
    );
  }
}
