import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Public } from '@/shared/common/decorators/public.decorator';
import { MedicationsService } from '@/modules/catalog/application/medications.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { QueryCatalogEntryDto } from './dto/query-catalog-entry.dto';

@ApiTags('catalog')
@Controller('catalog/medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post()
  create(@Body() dto: CreateMedicationDto) {
    return this.medicationsService.create(dto);
  }

  @Public()
  @Get()
  findAll(@Query() query: QueryCatalogEntryDto) {
    return this.medicationsService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicationsService.findOne(id);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMedicationDto) {
    return this.medicationsService.update(id, dto);
  }
}
