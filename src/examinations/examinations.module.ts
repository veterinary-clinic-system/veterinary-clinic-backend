import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Appointment,
  Doctor,
  Examination,
  LabTestOrder,
  Medication,
  Prescription,
  PrescriptionItem,
} from '@/database/entities';
import { ExaminationsController } from './examinations.controller';
import { ExaminationsService } from './examinations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Examination,
      Prescription,
      PrescriptionItem,
      LabTestOrder,
      Appointment,
      Doctor,
      Medication,
    ]),
  ],
  controllers: [ExaminationsController],
  providers: [ExaminationsService],
  exports: [ExaminationsService],
})
export class ExaminationsModule {}
