import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { TriageModule } from '@/modules/triage/triage.module';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Vaccine } from '@/modules/catalog/domain/entities/vaccine.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { Vaccination } from '@/modules/clinical/domain/entities/vaccination.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { Treatment } from '@/modules/clinical/domain/entities/treatment.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { LaboratoryResult } from '@/modules/clinical/domain/entities/laboratory-result.entity';
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
import { VaccinationsController } from '@/modules/clinical/presentation/vaccinations.controller';
import { LaboratoriesController } from '@/modules/clinical/presentation/laboratories.controller';
import { ExaminationsService } from '@/modules/clinical/application/examinations.service';
import { MedicalRecordsService } from '@/modules/clinical/application/medical-records.service';
import { PrescriptionsService } from '@/modules/clinical/application/prescriptions.service';
import { VaccinationsService } from '@/modules/clinical/application/vaccinations.service';
import { LaboratoriesService } from '@/modules/clinical/application/laboratories.service';
import { VaccinationReminderService } from '@/modules/clinical/application/vaccination-reminder.service';

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
      LaboratoryResult,
      Vaccination,
      Appointment,
      Doctor,
      Pet,
      Medication,
      Vaccine,
    ]),

    CatalogModule,
    TriageModule,

    NotificationModule,
  ],
  controllers: [
    ExaminationsController,
    MedicalRecordsController,
    DiagnosesController,
    TreatmentsController,
    PrescriptionsController,
    VaccinationsController,
    LaboratoriesController,
  ],
  providers: [
    ExaminationsService,
    MedicalRecordsService,
    PrescriptionsService,
    VaccinationsService,
    LaboratoriesService,
    VaccinationReminderService,
  ],
  exports: [
    ExaminationsService,
    MedicalRecordsService,
    PrescriptionsService,
    VaccinationsService,
    LaboratoriesService,
  ],
})
export class ClinicalModule {}
