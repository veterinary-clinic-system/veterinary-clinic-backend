import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Public } from '@/shared/common/decorators/public.decorator';
import { ServicesService } from '@/modules/catalog/application/services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryCatalogEntryDto } from './dto/query-catalog-entry.dto';

@ApiTags('catalog')
@Controller('catalog/services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Public()
  @Get()
  findAll(@Query() query: QueryCatalogEntryDto) {
    return this.servicesService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }
}
