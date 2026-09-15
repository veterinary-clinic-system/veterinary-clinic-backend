import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { VaccinationsService } from '@/modules/clinical/application/vaccinations.service';
import { CreateVaccinationDto } from './dto/create-vaccination.dto';
import { QueryVaccinationsDueDto } from './dto/query-vaccinations-due.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('vaccinations')
@Controller('vaccinations')
export class VaccinationsController {
  constructor(private readonly vaccinationsService: VaccinationsService) {}

  @RequirePermissions(Permission.VACCINATION_CREATE)
  @Audit({ action: AuditAction.DISPENSE, entity: 'Vaccination' })
  @Post()
  create(@Body() dto: CreateVaccinationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vaccinationsService.create(dto, actor);
  }

  @RequirePermissions(Permission.VACCINATION_VIEW)
  @Get('due')
  findDue(@Query() query: QueryVaccinationsDueDto) {
    return this.vaccinationsService.findDue(query);
  }

  @RequirePermissions(Permission.VACCINATION_VIEW)
  @Get('by-pet/:petId')
  findByPet(@Param('petId', ParseUUIDPipe) petId: string) {
    return this.vaccinationsService.findByPet(petId);
  }

  @RequirePermissions(Permission.VACCINATION_VIEW)
  @Get('by-medical-record/:medicalRecordId')
  findByMedicalRecord(@Param('medicalRecordId', ParseUUIDPipe) medicalRecordId: string) {
    return this.vaccinationsService.findByMedicalRecord(medicalRecordId);
  }
}
