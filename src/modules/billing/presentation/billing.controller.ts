import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { BillingService } from '@/modules/billing/application/billing.service';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

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
  @Patch('invoices/:id/pay')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayInvoiceDto) {
    return this.billingService.pay(id, dto);
  }
}
