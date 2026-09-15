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
