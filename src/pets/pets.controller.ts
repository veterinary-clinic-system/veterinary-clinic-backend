import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { QueryPetsDto } from './dto/query-pets.dto';

@ApiTags('pets')
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  /** Receptionist/Doctor/Admin adding a pet to an existing owner's profile (Section 4.1.1). */
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePetDto) {
    return this.petsService.create(dto);
  }

  /** Paginated staff search ("Search profiles by name, phone number, or record ID"). */
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  @Get()
  findAll(@Query() query: QueryPetsDto) {
    return this.petsService.findAll(query);
  }

  /** Registered before `:id` so it isn't swallowed by the param route. */
  @Roles(Role.PET_OWNER)
  @Get('mine')
  findMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.petsService.findMine(actor);
  }

  /**
   * Intentionally no `@Roles(...)`: staff roles always pass, and a PetOwner is allowed
   * through to view their own pet - `PetsService.findOneForActor` branches on that and
   * throws `ForbiddenException` for anyone else's pet.
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.petsService.findOneForActor(id, actor);
  }

  /** Same open-route + owner-self-access branch as `GET /pets/:id` above. */
  @Get(':id/timeline')
  getTimeline(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.petsService.getTimeline(id, actor);
  }

  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePetDto) {
    return this.petsService.update(id, dto);
  }
}
