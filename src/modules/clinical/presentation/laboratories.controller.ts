import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { LaboratoriesService } from '@/modules/clinical/application/laboratories.service';
import { SaveLaboratoryResultsDto } from './dto/save-laboratory-results.dto';
import { QueryLabQueueDto } from './dto/query-lab-queue.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('laboratories')
@Controller('laboratories')
export class LaboratoriesController {
  constructor(private readonly laboratoriesService: LaboratoriesService) {}

  @RequirePermissions(Permission.LABORATORY_VIEW)
  @Get('queue')
  findQueue(@Query() query: QueryLabQueueDto) {
    return this.laboratoriesService.findQueue(query);
  }

  @RequirePermissions(Permission.LABORATORY_VIEW)
  @Get('by-pet/:petId/parameters')
  findParameters(@Param('petId', ParseUUIDPipe) petId: string) {
    return this.laboratoriesService.findParameters(petId);
  }

  @RequirePermissions(Permission.LABORATORY_VIEW)
  @Get('by-pet/:petId/trends')
  findTrends(@Param('petId', ParseUUIDPipe) petId: string, @Query('parameter') parameter: string) {
    return this.laboratoriesService.findTrends(petId, parameter ?? '');
  }

  @RequirePermissions(Permission.LABORATORY_VIEW)
  @Get('by-pet/:petId')
  findByPet(@Param('petId', ParseUUIDPipe) petId: string) {
    return this.laboratoriesService.findByPet(petId);
  }

  @RequirePermissions(Permission.LABORATORY_VIEW)
  @Get('by-medical-record/:medicalRecordId')
  findByMedicalRecord(@Param('medicalRecordId', ParseUUIDPipe) medicalRecordId: string) {
    return this.laboratoriesService.findByMedicalRecord(medicalRecordId);
  }

  @RequirePermissions(Permission.LABORATORY_VIEW)
  @Get('orders/:id')
  findOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.laboratoriesService.findOrder(id);
  }

  @RequirePermissions(Permission.LABORATORY_RESULT_ENTER)
  @Audit({ action: AuditAction.UPDATE, entity: 'LabTestOrder' })
  @Put('orders/:id/results')
  saveResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveLaboratoryResultsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.laboratoriesService.saveResults(id, dto, actor);
  }
}
