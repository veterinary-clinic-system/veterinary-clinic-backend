import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Appointment,
  Branch,
  Doctor,
  DoctorBreak,
  DoctorShift,
  OperatingHour,
  Pet,
  Service,
  User,
} from '@/database/entities';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PrescreeningModule } from '@/prescreening/prescreening.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AvailabilityService } from './scheduling/availability.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      User,
      Pet,
      Doctor,
      Service,
      Branch,
      OperatingHour,
      DoctorShift,
      DoctorBreak,
    ]),
    NotificationsModule,
    PrescreeningModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AvailabilityService],
  exports: [AppointmentsService, AvailabilityService],
})
export class AppointmentsModule {}
