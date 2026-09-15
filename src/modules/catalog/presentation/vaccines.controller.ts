import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { VaccinesService } from '@/modules/catalog/application/vaccines.service';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { UpdateVaccineDto } from './dto/update-vaccine.dto';
import { QueryVaccinesDto } from './dto/query-vaccines.dto';

@ApiTags('catalog')
@Controller('catalog/vaccines')
export class VaccinesController {
  constructor(private readonly vaccinesService: VaccinesService) {}

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post()
  create(@Body() dto: CreateVaccineDto) {
    return this.vaccinesService.create(dto);
  }

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Get()
  findAll(@Query() query: QueryVaccinesDto) {
    return this.vaccinesService.findAll(query);
  }

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vaccinesService.findOne(id);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVaccineDto) {
    return this.vaccinesService.update(id, dto);
  }
}
