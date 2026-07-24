import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { MedicationsService } from './medications.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { QueryCatalogEntryDto } from './dto/query-catalog-entry.dto';

@ApiTags('catalog')
@Controller('catalog/medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Roles(Role.ADMIN)
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

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMedicationDto) {
    return this.medicationsService.update(id, dto);
  }
}
