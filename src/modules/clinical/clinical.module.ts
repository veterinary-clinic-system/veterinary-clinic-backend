import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '@/modules/catalog/catalog.module';
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
import { PrescriptionsController } from '@/modules/clinical/presentation/prescriptions.controller';
import { ExaminationsService } from '@/modules/clinical/application/examinations.service';
import { MedicalRecordsService } from '@/modules/clinical/application/medical-records.service';
import { PrescriptionsService } from '@/modules/clinical/application/prescriptions.service';

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
    ]),
    // P7: don thuoc tru kho khi cap phat. Chi duoc di qua barrel `catalog/application`
    // (tuc `InventoryService`) - ghi thang vao `inventory_items` la dieu P6 cam.
    CatalogModule,
  ],
  controllers: [
    ExaminationsController,
    MedicalRecordsController,
    DiagnosesController,
    TreatmentsController,
    PrescriptionsController,
  ],
  providers: [ExaminationsService, MedicalRecordsService, PrescriptionsService],
  exports: [ExaminationsService, MedicalRecordsService, PrescriptionsService],
})
export class ClinicalModule {}
