import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { InventoryTransactionType } from '@/shared/common/enums/inventory-transaction-type.enum';
import { InventoryAlertsService } from '@/modules/catalog/application/inventory-alerts.service';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { IssueInventoryDto, ReceiveInventoryDto } from './dto/issue-inventory.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('catalog')
@Controller('catalog/inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryAlertsService: InventoryAlertsService,
  ) {}

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get('alerts')
  alerts(@Query('branchId') branchId?: string) {
    return this.inventoryAlertsService.collect(branchId);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get(':id/batches')
  findBatches(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findBatchesOf(id);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Post()
  create(@Body() dto: CreateInventoryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventoryService.create(dto, actor.userId);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Audit({ action: AuditAction.STOCK_ADJUSTMENT, entity: 'InventoryItem', snapshot: false })
  @Post('receive')
  receive(@Body() dto: ReceiveInventoryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventoryService.receive({
      itemId: dto.itemId,
      branchId: dto.branchId,
      batchNo: dto.batchNo,
      expiryDate: dto.expiryDate ?? null,
      quantity: dto.quantity,
      costPrice: dto.costPrice ?? 0,
      supplierId: dto.supplierId ?? null,
      type: InventoryTransactionType.PURCHASE,
      performedByUserId: actor.userId,
      note: dto.note ?? null,
    });
  }

  @RequirePermissions(Permission.INVENTORY_EXPORT)
  @Audit({ action: AuditAction.STOCK_ADJUSTMENT, entity: 'InventoryItem', snapshot: false })
  @Post('issue')
  issue(@Body() dto: IssueInventoryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventoryService.issue({
      itemId: dto.itemId,
      branchId: dto.branchId,
      quantity: dto.quantity,
      type: dto.type,
      performedByUserId: actor.userId,
      note: dto.note,
    });
  }

  @RequirePermissions(Permission.INVENTORY_EXPORT)
  @Audit({ action: AuditAction.STOCK_ADJUSTMENT, entity: 'InventoryItem' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.inventoryService.update(id, dto, actor.userId);
  }
}
