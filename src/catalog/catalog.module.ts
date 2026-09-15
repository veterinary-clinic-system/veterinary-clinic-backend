import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch, Disease, InventoryItem, Item, Medication, Service } from '@/database/entities';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { DiseasesController } from './diseases.controller';
import { DiseasesService } from './diseases.service';

/**
 * Catalog module - the system of record for the clinic's price list (Services +
 * Medications, each backed 1:1 by an Item), per-branch stock (InventoryItem), and the
 * Disease reference catalog used by the AI/prescreening pipeline and doctors.
 * `Branch` is only ever read here (to validate `branchId` on inventory writes) - it is
 * owned by another module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Item, Service, Medication, InventoryItem, Disease, Branch])],
  controllers: [
    ItemsController,
    ServicesController,
    MedicationsController,
    InventoryController,
    DiseasesController,
  ],
  providers: [ItemsService, ServicesService, MedicationsService, InventoryService, DiseasesService],
  exports: [ItemsService, ServicesService, MedicationsService, InventoryService, DiseasesService],
})
export class CatalogModule {}
