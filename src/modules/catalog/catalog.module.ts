import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { ItemsController } from '@/modules/catalog/presentation/items.controller';
import { ItemsService } from '@/modules/catalog/application/items.service';
import { ServicesController } from '@/modules/catalog/presentation/services.controller';
import { ServicesService } from '@/modules/catalog/application/services.service';
import { MedicationsController } from '@/modules/catalog/presentation/medications.controller';
import { MedicationsService } from '@/modules/catalog/application/medications.service';
import { InventoryController } from '@/modules/catalog/presentation/inventory.controller';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { DiseasesController } from '@/modules/catalog/presentation/diseases.controller';
import { DiseasesService } from '@/modules/catalog/application/diseases.service';

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
