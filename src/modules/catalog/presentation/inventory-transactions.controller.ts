import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { QueryInventoryTransactionsDto } from './dto/query-inventory-transactions.dto';

/**
 * So cai xuat-nhap kho - SRS FR-18-02, muc 15.
 *
 * CHI CO GET. So cai la ban ghi bat bien: khong POST (dong so cai chi sinh ra tu mot
 * nghiep vu kho that), khong PATCH, khong DELETE. Sua sai bang mot phieu kiem ke co ghi
 * ly do, khong bang cach sua lich su.
 */
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
