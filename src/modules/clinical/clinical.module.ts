import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { Treatment } from '@/modules/clinical/domain/entities/treatment.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { PrescriptionItem } from '@/modules/clinical/domain/entities/prescription-item.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { ExaminationsController } from '@/modules/clinical/presentation/examinations.controller';
import {
  DiagnosesController,
  MedicalRecordsController,
  TreatmentsController,
} from '@/modules/clinical/presentation/medical-records.controller';
import { ExaminationsService } from '@/modules/clinical/application/examinations.service';
import { MedicalRecordsService } from '@/modules/clinical/application/medical-records.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      Diagnosis,
      Treatment,
      Examination,
      Prescription,
      PrescriptionItem,
      LabTestOrder,
      Appointment,
      Doctor,
      Pet,
      Medication,
      InventoryItem,
    ]),
  ],
  controllers: [
    ExaminationsController,
    MedicalRecordsController,
    DiagnosesController,
    TreatmentsController,
  ],
  providers: [ExaminationsService, MedicalRecordsService],
  exports: [ExaminationsService, MedicalRecordsService],
})
export class ClinicalModule {}
