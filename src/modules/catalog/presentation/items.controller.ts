import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/shared/common/decorators/public.decorator';
import { ItemsService } from '@/modules/catalog/application/items.service';
import { QueryItemsDto } from './dto/query-items.dto';

/**
 * Public price-list read - the marketing site's "services & pricing" page and other
 * backend modules read current prices through this generic Item view (Service,
 * Medication, lab tests, and anything else priced/stocked all live in `items`).
 */
@ApiTags('catalog')
@Controller('catalog/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Public()
  @Get()
  findAll(@Query() query: QueryItemsDto) {
    return this.itemsService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.itemsService.findOne(id);
  }
}
