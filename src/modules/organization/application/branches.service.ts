import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { OperatingHour } from '@/modules/organization/domain/entities/operating-hour.entity';
import { CreateBranchDto } from '@/modules/organization/presentation/dto/create-branch.dto';
import { UpdateBranchDto } from '@/modules/organization/presentation/dto/update-branch.dto';
import { OperatingHourDto } from '@/modules/organization/presentation/dto/operating-hour.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly branchesRepository: Repository<Branch>,
    @InjectRepository(OperatingHour)
    private readonly operatingHoursRepository: Repository<OperatingHour>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Public branch list (marketing site / booking flow) - active branches only. */
  findAllPublic(): Promise<Branch[]> {
    return this.branchesRepository.find({
      where: { active: true },
      relations: ['openingHours'],
      order: { branchName: 'ASC' },
    });
  }

  /** Admin management screen - every branch, including inactive ones. */
  findAllAdmin(): Promise<Branch[]> {
    return this.branchesRepository.find({
      relations: ['openingHours'],
      order: { branchName: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Branch> {
    const branch = await this.branchesRepository.findOne({
      where: { id },
      relations: ['openingHours'],
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  create(dto: CreateBranchDto): Promise<Branch> {
    const branch = this.branchesRepository.create({
      branchName: dto.branchName,
      phone: dto.phone,
      description: dto.description ?? null,
      address: dto.address,
    });
    return this.branchesRepository.save(branch);
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const branch = await this.findOne(id);

    Object.assign(branch, {
      ...(dto.branchName !== undefined ? { branchName: dto.branchName } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    await this.branchesRepository.save(branch);
    return this.findOne(id);
  }

  /**
   * Replaces a branch's entire weekly schedule in one call (delete-all-then-insert, inside
   * a transaction) so the client never has to diff individual rows - it just posts the
   * full week it wants. `dayOfWeek`/`openTime`/`closeTime` shape is already validated by
   * `OperatingHourDto`; `openTime < closeTime` is re-checked here per row since that's a
   * cross-field rule class-validator decorators alone can't express cleanly.
   */
  async replaceOpeningHours(branchId: string, hours: OperatingHourDto[]): Promise<OperatingHour[]> {
    await this.findOne(branchId); // 404s if the branch doesn't exist

    for (const hour of hours) {
      if (hour.openTime >= hour.closeTime) {
        throw new BadRequestException(
          `Invalid opening hours for day ${hour.dayOfWeek}: openTime (${hour.openTime}) must be before closeTime (${hour.closeTime})`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(OperatingHour, { branchId });

      if (hours.length === 0) {
        return [];
      }

      const rows = hours.map((hour) =>
        manager.create(OperatingHour, {
          branchId,
          dayOfWeek: hour.dayOfWeek,
          openTime: hour.openTime,
          closeTime: hour.closeTime,
        }),
      );
      return manager.save(OperatingHour, rows);
    });
  }
}
