import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { BillingService } from '@/modules/billing/application/billing.service';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Post('appointments/:appointmentId/invoice')
  generateInvoice(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.billingService.generateForAppointment(appointmentId);
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Get('invoices')
  findAll(@Query() query: QueryInvoicesDto) {
    return this.billingService.findAll(query);
  }

  // Registered before ':id' - same convention as ExaminationsController - though Nest's
  // router already disambiguates these by segment count (this path has one extra
  // segment), so ordering here is for readability, not correctness.
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  @Get('invoices/by-appointment/:appointmentId')
  findByAppointment(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.billingService.findByAppointment(appointmentId);
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Get('invoices/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingService.findOne(id);
  }

  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Patch('invoices/:id/pay')
  pay(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PayInvoiceDto) {
    return this.billingService.pay(id, dto);
  }
}
