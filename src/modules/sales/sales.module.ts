import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '@/modules/billing/billing.module';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { CartItem } from '@/modules/sales/domain/entities/cart-item.entity';
import { Cart } from '@/modules/sales/domain/entities/cart.entity';
import { PosService } from '@/modules/sales/application/pos.service';
import { PosController } from '@/modules/sales/presentation/pos.controller';

/**
 * Ban hang tai quay (POS) - SRS FR-19, UC-04.
 *
 * Module nay la NGUOI GOI cua hai module khac, khong ai goi nguoc lai no:
 *   - `CatalogModule` -> `InventoryService` de kiem ton va tru kho (BR-09, BR-12),
 *   - `BillingModule` -> `PaymentsService` de ghi tien thu duoc (FR-21).
 *
 * Ca hai deu di qua be mat cong khai cua module do (`application/index.ts` va danh sach
 * `exports`), khong voi vao ben trong - ESLint chan cung dieu do.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, Item, Branch, User]),
    CatalogModule,
    BillingModule,
  ],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class SalesModule {}
