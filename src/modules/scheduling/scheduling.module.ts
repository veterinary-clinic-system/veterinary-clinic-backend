import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { OperatingHour } from '@/modules/organization/domain/entities/operating-hour.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { DoctorBreak } from '@/modules/scheduling/domain/entities/doctor-break.entity';
import { DoctorShift } from '@/modules/scheduling/domain/entities/doctor-shift.entity';
import { QueueEntry } from '@/modules/scheduling/domain/entities/queue-entry.entity';
import { NotificationModule } from '@/modules/notification/notification.module';
import { TriageModule } from '@/modules/triage/triage.module';
import { AppointmentsController } from '@/modules/scheduling/presentation/appointments.controller';
import { QueueController } from '@/modules/scheduling/presentation/queue.controller';
import { AppointmentsService } from '@/modules/scheduling/application/appointments.service';
import { AvailabilityService } from '@/modules/scheduling/application/availability.service';
import { PartyResolverService } from '@/modules/scheduling/application/party-resolver.service';
import { QueueService } from '@/modules/scheduling/application/queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      QueueEntry,
      User,
      Pet,
      Doctor,
      Service,
      Branch,
      OperatingHour,
      DoctorShift,
      DoctorBreak,
    ]),
    NotificationModule,
    TriageModule,
  ],
  controllers: [AppointmentsController, QueueController],
  providers: [AppointmentsService, AvailabilityService, PartyResolverService, QueueService],
  exports: [AppointmentsService, AvailabilityService, QueueService],
})
export class SchedulingModule {}
