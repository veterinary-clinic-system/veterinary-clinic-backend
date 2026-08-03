import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { DiseasesService } from '@/modules/catalog/application/diseases.service';
import { CreateDiseaseDto } from './dto/create-disease.dto';
import { UpdateDiseaseDto } from './dto/update-disease.dto';
import { QueryDiseasesDto } from './dto/query-diseases.dto';

@ApiTags('catalog')
@Controller('catalog/diseases')
export class DiseasesController {
  constructor(private readonly diseasesService: DiseasesService) {}

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
  @Get()
  findAll(@Query() query: QueryDiseasesDto) {
    return this.diseasesService.findAll(query);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateDiseaseDto) {
    return this.diseasesService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiseaseDto) {
    return this.diseasesService.update(id, dto);
  }
}
