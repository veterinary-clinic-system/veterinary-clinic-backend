import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Prescription } from '@/modules/clinical/domain/entities/prescription.entity';
import { LabTestOrder } from '@/modules/clinical/domain/entities/lab-test-order.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { PetsController } from '@/modules/pets/presentation/pets.controller';
import { PetsService } from '@/modules/pets/application/pets.service';
import { PetProfileService } from '@/modules/pets/application/pet-profile.service';
import { SpeciesController } from '@/modules/pets/presentation/species.controller';
import { SpeciesService } from '@/modules/pets/application/species.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      Species,
      Breed,
      // Read-only reads into other modules' tables (owner lookups, medical-record
      // timeline, cac khoi cua trang ho so thu cung FR-04-03) - not calling into their
      // services, same pattern as SchedulingModule.
      User,
      Appointment,
      MedicalRecord,
      Prescription,
      LabTestOrder,
      Invoice,
    ]),
  ],
  controllers: [PetsController, SpeciesController],
  providers: [PetsService, PetProfileService, SpeciesService],
  exports: [PetsService, SpeciesService],
})
export class PetsModule {}
