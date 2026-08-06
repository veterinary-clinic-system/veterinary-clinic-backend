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

/**
 * Don thuoc va cap phat - SRS FR-11, BR-10.
 *
 * PHAN QUYEN O DAY LA MOT THE KIEM TRA CHEO, khong phai thu tuc hanh chinh:
 * `PRESCRIPTION_CREATE` (bac si) va `PRESCRIPTION_DISPENSE` (duoc si) co chu dich
 * KHONG chong nhau trong ma tran mac dinh. Nguoi ke thuoc khong phai nguoi lay thuoc
 * ra khoi kho - do la cach mot y lenh sai hoac mot lan lay thuoc khong co y lenh bi
 * phat hien. ADMIN co ca hai (SRS 4.1 "toan quyen"), day la ngoai le duy nhat.
 *
 * Vi vay acceptance cua P7-T5 doi: bac si goi `/dispense` -> 403, duoc si goi
 * `POST /prescriptions` -> 403.
 */
@ApiTags('clinical')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  /**
   * Hang cho quay thuoc = `?status=PRESCRIBED`. Mac dinh sap cu nhat truoc cho loc do -
   * xem `PrescriptionsService.findAll`.
   */
  @RequirePermissions(Permission.PRESCRIPTION_VIEW)
  @Get()
  findAll(@Query() query: QueryPrescriptionsDto) {
    return this.prescriptionsService.findAll(query);
  }

  /** Tra ve don kem `stockCheck` tung dong - FE dung de to do dong thieu ton. */
  @RequirePermissions(Permission.PRESCRIPTION_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  /**
   * Ke don vao mot ho so benh an. CANH BAO khi thieu ton, khong chan (FR-11-02) -
   * xem comment dau `PrescriptionsService`.
   */
  @RequirePermissions(Permission.PRESCRIPTION_CREATE)
  @Post()
  create(@Body() dto: CreateStandalonePrescriptionDto) {
    return this.prescriptionsService.create(dto.medicalRecordId, dto);
  }

  /** Chi sua duoc khi don con `PRESCRIBED` (P7-T2). */
  @RequirePermissions(Permission.PRESCRIPTION_CREATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrescriptionDto) {
    return this.prescriptionsService.update(id, dto);
  }

  /** Duoc si nhan don ve quay. Chua dong toi kho. */
  @RequirePermissions(Permission.PRESCRIPTION_DISPENSE)
  @Post(':id/start-dispense')
  startDispensing(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.startDispensing(id);
  }

  /** Xac nhan da soan du -> tru kho ca don trong mot transaction (BR-10). */
  @RequirePermissions(Permission.PRESCRIPTION_DISPENSE)
  @Audit({ action: AuditAction.DISPENSE, entity: 'Prescription' })
  @Post(':id/dispense')
  dispense(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.prescriptionsService.dispense(id, actor.userId);
  }

  /**
   * Huy don. Can quyen KE chu khong phai quyen CAP PHAT: huy mot y lenh la viec cua
   * nguoi ra y lenh do.
   */
  @RequirePermissions(Permission.PRESCRIPTION_CREATE)
  @Audit({ action: AuditAction.CANCEL, entity: 'Prescription' })
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.cancel(id);
  }
}
