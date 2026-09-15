import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { Disease } from '@/modules/catalog/domain/entities/disease.entity';
import { GoodsReceipt } from '@/modules/catalog/domain/entities/goods-receipt.entity';
import { GoodsReceiptItem } from '@/modules/catalog/domain/entities/goods-receipt-item.entity';
import { InventoryBatch } from '@/modules/catalog/domain/entities/inventory-batch.entity';
import { InventoryItem } from '@/modules/catalog/domain/entities/inventory-item.entity';
import { InventoryTransaction } from '@/modules/catalog/domain/entities/inventory-transaction.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Medication } from '@/modules/catalog/domain/entities/medication.entity';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PurchaseOrder } from '@/modules/catalog/domain/entities/purchase-order.entity';
import { PurchaseOrderItem } from '@/modules/catalog/domain/entities/purchase-order-item.entity';
import { Service } from '@/modules/catalog/domain/entities/service.entity';
import { StockTake } from '@/modules/catalog/domain/entities/stock-take.entity';
import { StockTakeItem } from '@/modules/catalog/domain/entities/stock-take-item.entity';
import { Supplier } from '@/modules/catalog/domain/entities/supplier.entity';
import { Vaccine } from '@/modules/catalog/domain/entities/vaccine.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Pet } from '@/modules/pets/domain/entities/pet.entity';
import { Species } from '@/modules/pets/domain/entities/species.entity';
import { NotificationModule } from '@/modules/notification/notification.module';
import { ItemsController } from '@/modules/catalog/presentation/items.controller';
import { ItemsService } from '@/modules/catalog/application/items.service';
import { ServicesController } from '@/modules/catalog/presentation/services.controller';
import { ServicesService } from '@/modules/catalog/application/services.service';
import { MedicationsController } from '@/modules/catalog/presentation/medications.controller';
import { MedicationsService } from '@/modules/catalog/application/medications.service';
import { InventoryController } from '@/modules/catalog/presentation/inventory.controller';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { InventoryAlertsService } from '@/modules/catalog/application/inventory-alerts.service';
import { InventoryTransactionsController } from '@/modules/catalog/presentation/inventory-transactions.controller';
import { PurchaseOrdersController } from '@/modules/catalog/presentation/purchase-orders.controller';
import { PurchaseOrdersService } from '@/modules/catalog/application/purchase-orders.service';
import { GoodsReceiptsController } from '@/modules/catalog/presentation/goods-receipts.controller';
import { GoodsReceiptsService } from '@/modules/catalog/application/goods-receipts.service';
import { StockTakesController } from '@/modules/catalog/presentation/stock-takes.controller';
import { StockTakesService } from '@/modules/catalog/application/stock-takes.service';
import { DiseasesController } from '@/modules/catalog/presentation/diseases.controller';
import { DiseasesService } from '@/modules/catalog/application/diseases.service';
import { CategoriesController } from '@/modules/catalog/presentation/categories.controller';
import { CategoriesService } from '@/modules/catalog/application/categories.service';
import { ProductsController } from '@/modules/catalog/presentation/products.controller';
import { ProductsService } from '@/modules/catalog/application/products.service';
import { SuppliersController } from '@/modules/catalog/presentation/suppliers.controller';
import { SuppliersService } from '@/modules/catalog/application/suppliers.service';
import { VaccinesController } from '@/modules/catalog/presentation/vaccines.controller';
import { VaccinesService } from '@/modules/catalog/application/vaccines.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category,
      Item,
      Service,
      Medication,
      Product,
      Vaccine,
      Supplier,
      InventoryItem,
      InventoryBatch,
      InventoryTransaction,
      PurchaseOrder,
      PurchaseOrderItem,
      GoodsReceipt,
      GoodsReceiptItem,
      StockTake,
      StockTakeItem,
      Disease,
      Branch,

      Pet,
      Species,
    ]),
    NotificationModule,
  ],
  controllers: [
    CategoriesController,
    ItemsController,
    ServicesController,
    ProductsController,
    SuppliersController,
    MedicationsController,
    VaccinesController,
    InventoryController,
    InventoryTransactionsController,
    PurchaseOrdersController,
    GoodsReceiptsController,
    StockTakesController,
    DiseasesController,
  ],
  providers: [
    CategoriesService,
    ItemsService,
    ServicesService,
    MedicationsService,
    ProductsService,
    SuppliersService,
    VaccinesService,
    InventoryService,
    InventoryAlertsService,
    PurchaseOrdersService,
    GoodsReceiptsService,
    StockTakesService,
    DiseasesService,
  ],
  exports: [
    CategoriesService,
    ItemsService,
    ServicesService,
    MedicationsService,
    ProductsService,
    SuppliersService,
    VaccinesService,
    InventoryService,
    DiseasesService,
  ],
})
export class CatalogModule {}
