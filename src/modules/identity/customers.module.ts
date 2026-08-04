import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { CustomersController } from '@/modules/identity/presentation/customers.controller';
import { CustomersService } from '@/modules/identity/application/customers.service';

/**
 * Nghiep vu khach hang cua quay le tan. Pet/Appointment/Invoice o day chi duoc DOC
 * (dem thu cung, lich su giao dich) - cung cach PetsModule/SchedulingModule dang doc
 * bang cua module khac ma khong goi vao service cua chung.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Pet, Appointment, Invoice])],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
