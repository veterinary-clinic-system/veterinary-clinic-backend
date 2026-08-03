import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/shared/common/decorators/public.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
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

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateSpeciesDto) {
    return this.speciesService.create(dto);
  }

  @Public()
  @Get(':id/breeds')
  findBreeds(@Param('id', ParseUUIDPipe) id: string) {
    return this.speciesService.findBreeds(id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/breeds')
  createBreed(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateBreedDto) {
    return this.speciesService.createBreed(id, dto);
  }
}
