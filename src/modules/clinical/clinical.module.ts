import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Diagnosis } from '@/modules/clinical/domain/entities/diagnosis.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { PrescriptionItem } from '@/modules/clinical/domain/entities/prescription-item.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { Doctor } from '@/modules/identity/domain/entities/doctor.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { ExaminationsController } from '@/modules/clinical/presentation/examinations.controller';
import { ExaminationsService } from '@/modules/clinical/application/examinations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      Diagnosis,
      Examination,
      Prescription,
      PrescriptionItem,
      LabTestOrder,
      Appointment,
      Doctor,
      Medication,
      InventoryItem,
    ]),
  ],
  controllers: [ExaminationsController],
  providers: [ExaminationsService],
  exports: [ExaminationsService],
})
export class ClinicalModule {}
