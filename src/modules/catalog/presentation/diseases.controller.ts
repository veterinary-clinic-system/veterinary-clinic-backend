import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { DiseasesService } from '@/modules/catalog/application/diseases.service';
import { CreateDiseaseDto } from './dto/create-disease.dto';
import { UpdateDiseaseDto } from './dto/update-disease.dto';
import { QueryDiseasesDto } from './dto/query-diseases.dto';

@ApiTags('catalog')
@Controller('catalog/diseases')
export class DiseasesController {
  constructor(private readonly diseasesService: DiseasesService) {}

  @RequirePermissions(Permission.CATALOG_VIEW)
  @Get()
  findAll(@Query() query: QueryDiseasesDto) {
    return this.diseasesService.findAll(query);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post()
  create(@Body() dto: CreateDiseaseDto) {
    return this.diseasesService.create(dto);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiseaseDto) {
    return this.diseasesService.update(id, dto);
  }
}
