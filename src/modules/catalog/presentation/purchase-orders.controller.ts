import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { PurchaseOrdersService } from '@/modules/catalog/application/purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';

/**
 * Don dat hang - SRS UC-05, muc 15.
 *
 * Dat hang duoc coi la mot hanh vi NHAP kho (`INVENTORY_IMPORT`) du chua co hang nao
 * vao kho: no la buoc dau cua cung mot quy trinh, va nguoi duoc phep nhap hang cung la
 * nguoi duoc phep dat hang.
 */
@ApiTags('catalog')
@Controller('catalog/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Query() query: QueryPurchaseOrdersDto) {
    return this.purchaseOrdersService.findAll(query);
  }

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.purchaseOrdersService.create(dto, actor.userId);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.remove(id);
  }
}
