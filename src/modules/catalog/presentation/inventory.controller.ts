import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { InventoryService } from '@/modules/catalog/application/inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';

@ApiTags('catalog')
@Controller('catalog/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @RequirePermissions(Permission.INVENTORY_VIEW)
  @Get()
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventoryService.findAll(query);
  }

  /** Upsert semantics - see InventoryService.create(). */
  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Post()
  create(@Body() dto: CreateInventoryDto) {
    return this.inventoryService.create(dto);
  }

  @RequirePermissions(Permission.INVENTORY_IMPORT)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventoryService.update(id, dto);
  }
}
