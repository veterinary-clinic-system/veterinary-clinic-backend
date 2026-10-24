import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import { UsersController } from '@/modules/identity/presentation/users.controller';
import { UsersService } from '@/modules/identity/application/users.service';
import { AuditLogModule } from './audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Doctor, DoctorShift, DoctorBreak, Branch]),
    AuditLogModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
