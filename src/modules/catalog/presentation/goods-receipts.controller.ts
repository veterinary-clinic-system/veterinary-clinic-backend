import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { GoodsReceiptsService } from '@/modules/catalog/application/goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from './dto/query-goods-receipts.dto';

/**
 * Phieu nhap kho - SRS UC-05, BR-13, muc 15.
 *
 * KHONG CO PATCH VA DELETE. Phieu nhap da sinh ra cac dong so cai bat bien va da tang
 * ton that; sua no se lam chung tu va so cai noi nhau. Nhap sai thi lap phieu kiem ke
 * (`/catalog/stock-takes`) co ghi ly do - dau vet giu duoc ca hai buoc.
 */
@ApiTags('catalog')
@Controller('catalog/goods-receipts')
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Query() query: QueryGoodsReceiptsDto) {
    return this.goodsReceiptsService.findAll(query);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.goodsReceiptsService.findOne(id);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Post()
  create(@Body() dto: CreateGoodsReceiptDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.goodsReceiptsService.create(dto, actor.userId);
  }
}
