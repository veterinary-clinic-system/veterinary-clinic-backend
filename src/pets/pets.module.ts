import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, Breed, Pet, Species, User } from '@/database/entities';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';
import { SpeciesController } from './species.controller';
import { SpeciesService } from './species.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      Species,
      Breed,
      // Read-only reads into other modules' tables (owner lookups, examination-history
      // timeline) - not calling into their services, same pattern as AppointmentsModule.
      User,
      Appointment,
    ]),
  ],
  controllers: [PetsController, SpeciesController],
  providers: [PetsService, SpeciesService],
  exports: [PetsService, SpeciesService],
})
export class PetsModule {}
