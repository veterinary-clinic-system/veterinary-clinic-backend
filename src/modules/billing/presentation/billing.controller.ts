import {
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
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
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { renderInvoiceReceiptPdf } from '@/modules/billing/infrastructure/invoice-receipt-pdf.builder';

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

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('invoices/:id/payments')
  findPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findByInvoice(id);
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('invoices/:id/receipt.pdf')
  async receipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const invoice = await this.billingService.findOne(id);
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new ConflictException('Chỉ xuất biên lai cho hóa đơn đã thanh toán đủ');
    }
    const payments = await this.paymentsService.findByInvoice(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="receipt-${invoice.invoiceCode}.pdf"`);
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    renderInvoiceReceiptPdf(doc, invoice, payments);
    doc.end();
  }

  @RequirePermissions(Permission.INVOICE_CREATE)
  @Audit({ action: AuditAction.UPDATE, entity: 'Invoice' })
  @Patch('invoices/:id/items')
  replaceItems(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplaceInvoiceItemsDto) {
    return this.billingService.replaceItems(id, dto.items);
  }

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

  @RequirePermissions(Permission.INVOICE_CREATE)
  @Audit({ action: AuditAction.CANCEL, entity: 'Invoice' })
  @Post('invoices/:id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelInvoiceDto) {
    return this.billingService.cancel(id, dto.reason);
  }
}
