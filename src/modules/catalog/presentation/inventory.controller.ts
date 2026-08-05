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

/**
 * Kho - SRS FR-18.
 *
 * Phan quyen theo dung ba muc cua ma tran (P6-T8 acceptance):
 *   - `INVENTORY_VIEW`   : doc. STAFF ban hang chi co quyen nay, nen ho xem duoc ton
 *                          nhung khong nhap/xuat duoc gi.
 *   - `INVENTORY_IMPORT` : nhap kho, khai bao mat hang o chi nhanh.
 *   - `INVENTORY_EXPORT` : xuat kho va dieu chinh ton.
 *
 * Khong kem `@Roles`: quy uoc chung cua codebase - `role_permissions` la nguon su that
 * duy nhat, giu them mot danh sach vai tro o day la hai cho phai sua song song.
 */
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

  /**
   * Bon nhom canh bao - FR-18-04.
   *
   * Dat TRUOC `:id/batches` khong quan trong o day (khong dung chung dang route), nhung
   * van giu o dau nhom GET cho de doc.
   */
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get('alerts')
  alerts(@Query('branchId') branchId?: string) {
    return this.inventoryAlertsService.collect(branchId);
  }

  /** Cac lo cua mot dong ton kho, sap theo han dung gan nhat truoc. */
  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get(':id/batches')
  findBatches(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findBatchesOf(id);
  }

  /** Khai bao mat hang co mat o mot chi nhanh (kem ton ban dau neu co). */
  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Post()
  create(@Body() dto: CreateInventoryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventoryService.create(dto, actor.userId);
  }

  /** Nhap kho khong qua phieu nhap - hang mau, hang le, hang chuyen tu chi nhanh khac. */
  @RequirePermissions(Permission.INVENTORY_IMPORT)
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

  /**
   * Xuat kho thu cong (hang hong, het han, that lac, tra hang) - FEFO, BR-11.
   *
   * Ban le va cap thuoc KHONG di qua day: xem comment o `IssueInventoryDto`.
   */
  @RequirePermissions(Permission.INVENTORY_EXPORT)
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
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.inventoryService.update(id, dto, actor.userId);
  }
}
