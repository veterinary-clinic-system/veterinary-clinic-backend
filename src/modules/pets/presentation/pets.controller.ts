import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PetsService } from '@/modules/pets/application/pets.service';
import { PetProfileService } from '@/modules/pets/application/pet-profile.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { QueryPetsDto } from './dto/query-pets.dto';

@ApiTags('pets')
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly petProfileService: PetProfileService,
  ) {}

  /** Receptionist/Doctor/Admin adding a pet to an existing owner's profile (Section 4.1.1). */
  @RequirePermissions(Permission.PET_CREATE)
  @Post()
  create(@Body() dto: CreatePetDto) {
    return this.petsService.create(dto);
  }

  /** Paginated staff search ("Search profiles by name, phone number, or record ID"). */
  @RequirePermissions(Permission.PET_VIEW)
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

  // ---------------------------------------------------------------------------------
  // Cac khoi cua trang ho so thu cung (FR-04-03 / muc 12.4 SRS)
  //
  // Deu la route cua NHAN VIEN: `@RequirePermissions` tu dong tu choi PET_OWNER (ho
  // khong co dong nao trong ma tran `role_permissions`). Cong tu phuc vu cua chu thu
  // cung van la `/pets/:id` + `/pets/:id/timeline` o tren.
  //
  // Khoi "Vaccination" chua co route: bang tiem chung se ra doi o Phase 9.
  // ---------------------------------------------------------------------------------

  @RequirePermissions(Permission.PET_VIEW, Permission.APPOINTMENT_VIEW)
  @Get(':id/appointments')
  findAppointments(@Param('id', ParseUUIDPipe) id: string) {
    return this.petProfileService.findAppointments(id);
  }

  @RequirePermissions(Permission.PET_VIEW, Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/medical-history')
  findMedicalHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.petProfileService.findMedicalHistory(id);
  }

  @RequirePermissions(Permission.PET_VIEW, Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/prescriptions')
  findPrescriptions(@Param('id', ParseUUIDPipe) id: string) {
    return this.petProfileService.findPrescriptions(id);
  }

  @RequirePermissions(Permission.PET_VIEW, Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/lab-tests')
  findLabTests(@Param('id', ParseUUIDPipe) id: string) {
    return this.petProfileService.findLabTests(id);
  }

  @RequirePermissions(Permission.PET_VIEW, Permission.INVOICE_VIEW)
  @Get(':id/invoices')
  findInvoices(@Param('id', ParseUUIDPipe) id: string) {
    return this.petProfileService.findInvoices(id);
  }

  @RequirePermissions(Permission.PET_UPDATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePetDto) {
    return this.petsService.update(id, dto);
  }
}
