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
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('pets')
@Controller('pets')
export class PetsController {
  constructor(
    private readonly petsService: PetsService,
    private readonly petProfileService: PetProfileService,
  ) {}

  @RequirePermissions(Permission.PET_CREATE)
  @Audit({ action: AuditAction.CREATE, entity: 'Pet' })
  @Post()
  create(@Body() dto: CreatePetDto) {
    return this.petsService.create(dto);
  }

  @RequirePermissions(Permission.PET_VIEW)
  @Get()
  findAll(@Query() query: QueryPetsDto) {
    return this.petsService.findAll(query);
  }

  @Roles(Role.PET_OWNER)
  @Get('mine')
  findMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.petsService.findMine(actor);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.petsService.findOneForActor(id, actor);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.petsService.getTimeline(id, actor);
  }

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
  @Audit({ action: AuditAction.UPDATE, entity: 'Pet' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePetDto) {
    return this.petsService.update(id, dto);
  }
}
