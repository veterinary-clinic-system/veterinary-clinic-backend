import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '@/modules/identity/domain/entities/employee.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { EmployeesController } from '@/modules/identity/presentation/employees.controller';
import { EmployeesService } from '@/modules/identity/application/employees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, User, Branch])],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
