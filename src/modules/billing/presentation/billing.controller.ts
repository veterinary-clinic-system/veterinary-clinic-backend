import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { Permission } from '@/shared/common/enums/permission.enum';
import { BillingService } from '@/modules/billing/application/billing.service';
import { PaymentsService } from '@/modules/billing/application/payments.service';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { CancelInvoiceDto, RefundInvoiceDto } from './dto/refund-invoice.dto';
import { ReplaceInvoiceItemsDto } from './dto/replace-invoice-items.dto';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @RequirePermissions(Permission.INVOICE_CREATE)
  @Post('appointments/:appointmentId/invoice')
  generateInvoice(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.billingService.generateForAppointment(appointmentId);
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('invoices')
  findAll(@Query() query: QueryInvoicesDto) {
    return this.billingService.findAll(query);
  }

  // Registered before ':id' - same convention as ExaminationsController - though Nest's
  // router already disambiguates these by segment count (this path has one extra
  // segment), so ordering here is for readability, not correctness.
  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('invoices/by-appointment/:appointmentId')
  findByAppointment(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.billingService.findByAppointment(appointmentId);
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('invoices/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOne(id);
  }

  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Audit({ action: AuditAction.PAYMENT, entity: 'Invoice' })
  @Patch('invoices/:id/pay')
  pay(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayInvoiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.billingService.pay(id, dto, actor.userId);
  }

  /** Cac lan tra cua mot hoa don - FR-21. Cu nhat truoc, gom ca dong hoan tien. */
  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('invoices/:id/payments')
  findPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findByInvoice(id);
  }

  /**
   * Sua cac dong hoa don - chi khi CHUA thu dong nao (BR-14).
   *
   * Dung `INVOICE_CREATE` chu khong them mot quyen rieng: ai lap duoc hoa don thi sua
   * duoc hoa don chua thanh toan cua chinh minh, con hoa don da thu tien thi khong ai
   * sua duoc ca - hang rao that nam o trang thai, khong o ma tran quyen.
   */
  @RequirePermissions(Permission.INVOICE_CREATE)
  @Audit({ action: AuditAction.UPDATE, entity: 'Invoice' })
  @Patch('invoices/:id/items')
  replaceItems(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceInvoiceItemsDto) {
    return this.billingService.replaceItems(id, dto.items);
  }

  /** Hoan tien - BR-14. `PAYMENT_REFUND` chi MANAGER/ADMIN co (P8-T7). */
  @RequirePermissions(Permission.PAYMENT_REFUND)
  @Audit({ action: AuditAction.PAYMENT, entity: 'Invoice' })
  @Post('invoices/:id/refund')
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundInvoiceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.billingService.refund(id, dto, actor.userId);
  }

  /** Huy hoa don - chi khi chua thu dong nao, nguoc lai 409 huong dan dung refund. */
  @RequirePermissions(Permission.INVOICE_CREATE)
  @Audit({ action: AuditAction.CANCEL, entity: 'Invoice' })
  @Post('invoices/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelInvoiceDto) {
    return this.billingService.cancel(id, dto.reason);
  }
}
