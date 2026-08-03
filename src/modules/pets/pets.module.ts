import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Breed } from '@/modules/pets/domain/entities/breed.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { PetsController } from '@/modules/pets/presentation/pets.controller';
import { PetsService } from '@/modules/pets/application/pets.service';
import { SpeciesController } from '@/modules/pets/presentation/species.controller';
import { SpeciesService } from '@/modules/pets/application/species.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      Species,
      Breed,
      // Read-only reads into other modules' tables (owner lookups, examination-history
      // timeline) - not calling into their services, same pattern as SchedulingModule.
      User,
      Appointment,
    ]),
  ],
  controllers: [PetsController, SpeciesController],
  providers: [PetsService, SpeciesService],
  exports: [PetsService, SpeciesService],
})
export class PetsModule {}
