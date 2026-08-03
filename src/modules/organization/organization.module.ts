import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { OperatingHour } from '@/modules/organization/domain/entities/operating-hour.entity';
import { BranchesController } from '@/modules/organization/presentation/branches.controller';
import { BranchesService } from '@/modules/organization/application/branches.service';

@Module({
  imports: [TypeOrmModule.forFeature([Branch, OperatingHour])],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class OrganizationModule {}
