import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Public } from '@/shared/common/decorators/public.decorator';
import { SpeciesService } from '@/modules/pets/application/species.service';
import { CreateBreedDto } from './dto/create-breed.dto';
import { CreateSpeciesDto } from './dto/create-species.dto';

/** Small reference catalog (Species -> Breed) needed by the pet-creation form's dropdowns. */
@ApiTags('species')
@Controller('species')
export class SpeciesController {
  constructor(private readonly speciesService: SpeciesService) {}

  @Public()
  @Get()
  findAll() {
    return this.speciesService.findAll();
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post()
  create(@Body() dto: CreateSpeciesDto) {
    return this.speciesService.create(dto);
  }

  @Public()
  @Get(':id/breeds')
  findBreeds(@Param('id', ParseUUIDPipe) id: string) {
    return this.speciesService.findBreeds(id);
  }

  @RequirePermissions(Permission.CATALOG_MANAGE)
  @Post(':id/breeds')
  createBreed(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateBreedDto) {
    return this.speciesService.createBreed(id, dto);
  }
}
