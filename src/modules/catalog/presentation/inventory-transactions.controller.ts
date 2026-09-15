import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { QueryInventoryTransactionsDto } from './dto/query-inventory-transactions.dto';

@ApiTags('catalog')
@Controller('catalog/inventory-transactions')
export class InventoryTransactionsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Query() query: QueryInventoryTransactionsDto) {
    return this.inventoryService.findTransactions(query);
  }
}
