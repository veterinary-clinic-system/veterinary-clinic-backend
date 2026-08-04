import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { MedicalRecordsService } from '@/modules/clinical/application/medical-records.service';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { CreateTreatmentDto } from './dto/create-treatment.dto';
import { OpenMedicalRecordDto } from './dto/open-medical-record.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';
import { UpdateMedicalRecordDto } from './dto/update-medical-record.dto';
import { UpdateTreatmentDto } from './dto/update-treatment.dto';

/**
 * SRS FR-07..FR-10 - ho so benh an.
 *
 * Phan quyen theo dung quy uoc tu P1: `@RequirePermissions` la hang rao duy nhat,
 * khong kem `@Roles`. Ket qua theo ma tran `role_permissions` hien tai:
 *   - DOCTOR + ADMIN co CREATE/UPDATE -> mo, sua, chot ho so (BR-07)
 *   - RECEPTIONIST / MANAGER / PHARMACIST chi co VIEW -> doc duoc, ghi thi 403
 *   - PET_OWNER khong co dong nao trong ma tran -> bi tu choi o moi endpoint
 */
@ApiTags('medical-records')
@Controller('medical-records')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @RequirePermissions(Permission.MEDICAL_RECORD_CREATE)
  @Post()
  open(@Body() dto: OpenMedicalRecordDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.medicalRecordsService.openForAppointment(dto, actor);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get('by-pet/:petId')
  getTimelineForPet(@Param('petId', ParseUUIDPipe) petId: string) {
    return this.medicalRecordsService.getTimelineForPet(petId);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get('by-appointment/:appointmentId')
  findByAppointment(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.medicalRecordsService.findByAppointment(appointmentId);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.complete(id);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_CREATE)
  @Post(':id/diagnoses')
  addDiagnosis(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDiagnosisDto) {
    return this.medicalRecordsService.addDiagnosis(id, dto);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_CREATE)
  @Post(':id/treatments')
  addTreatment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTreatmentDto) {
    return this.medicalRecordsService.addTreatment(id, dto);
  }

  // Hai route `:id` tran phai dung CUOI - dat truoc thi `by-pet`/`by-appointment` se
  // roi vao day va chet o ParseUUIDPipe (cung quy uoc voi examinations.controller.ts).
  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.findOne(id);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMedicalRecordDto) {
    return this.medicalRecordsService.update(id, dto);
  }
}

/**
 * Chan doan va dieu tri duoc TAO duoi ho so cha (`POST /medical-records/:id/...`)
 * nhung duoc SUA/XOA qua dinh danh cua chinh no. Ly do khong long thanh
 * `/medical-records/:recordId/diagnoses/:id`: id chan doan da la duy nhat toan cuc,
 * bat client mang theo id cha chi tao them mot tham so co the truyen sai ma server
 * van phai kiem tra lai.
 */
@ApiTags('medical-records')
@Controller('diagnoses')
export class DiagnosesController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDiagnosisDto) {
    return this.medicalRecordsService.updateDiagnosis(id, dto);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.removeDiagnosis(id);
  }
}

@ApiTags('medical-records')
@Controller('treatments')
export class TreatmentsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTreatmentDto) {
    return this.medicalRecordsService.updateTreatment(id, dto);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.medicalRecordsService.removeTreatment(id);
  }
}
