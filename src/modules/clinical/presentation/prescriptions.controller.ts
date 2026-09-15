import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { PrescriptionsService } from '@/modules/clinical/application/prescriptions.service';
import { CreateStandalonePrescriptionDto } from './dto/create-prescription.dto';
import { QueryPrescriptionsDto } from './dto/query-prescriptions.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('clinical')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @RequirePermissions(Permission.PRESCRIPTION_VIEW)
  @Get()
  findAll(@Query() query: QueryPrescriptionsDto) {
    return this.prescriptionsService.findAll(query);
  }

  @RequirePermissions(Permission.PRESCRIPTION_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @RequirePermissions(Permission.PRESCRIPTION_CREATE)
  @Post()
  create(@Body() dto: CreateStandalonePrescriptionDto) {
    return this.prescriptionsService.create(dto.medicalRecordId, dto);
  }

  @RequirePermissions(Permission.PRESCRIPTION_CREATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrescriptionDto) {
    return this.prescriptionsService.update(id, dto);
  }

  @RequirePermissions(Permission.PRESCRIPTION_DISPENSE)
  @Post(':id/start-dispense')
  startDispensing(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.startDispensing(id);
  }

  @RequirePermissions(Permission.PRESCRIPTION_DISPENSE)
  @Audit({ action: AuditAction.DISPENSE, entity: 'Prescription' })
  @Post(':id/dispense')
  dispense(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.prescriptionsService.dispense(id, actor.userId);
  }

  @RequirePermissions(Permission.PRESCRIPTION_CREATE)
  @Audit({ action: AuditAction.CANCEL, entity: 'Prescription' })
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.cancel(id);
  }
}
