import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { Public } from '@/shared/common/decorators/public.decorator';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { Audit } from '@/shared/common/decorators/audit.decorator';
import { AuditAction } from '@/shared/common/enums/audit-action.enum';
import { SepayService } from '@/modules/billing/application/sepay.service';
import { SepayWebhookDto } from './dto/sepay-webhook.dto';
import { ReconcileSepayTransactionDto } from './dto/reconcile-sepay-transaction.dto';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { PaymentRealtimeService } from '@/modules/billing/application/payment-realtime.service';
import { concat, from } from 'rxjs';
import { map } from 'rxjs/operators';

@ApiTags('billing')
@Controller('billing/sepay')
export class SepayController {
  constructor(
    private readonly sepayService: SepayService,
    private readonly realtimeService: PaymentRealtimeService,
  ) {}

  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Audit({ action: AuditAction.PAYMENT, entity: 'Invoice' })
  @Post('invoices/:id/qr')
  createQr(@Param('id', ParseUUIDPipe) id: string, @Query('amount') amount?: string) {
    return this.sepayService.createQrTicket(id, amount ? Number(amount) : undefined);
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('tickets/:paymentId')
  getTicket(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.sepayService.getTicketStatus(paymentId);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('public/tickets/:paymentId')
  getPublicTicket(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.sepayService.getTicketStatus(paymentId);
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Sse('tickets/:paymentId/events')
  ticketEvents(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return concat(
      from(this.sepayService.getTicketStatus(paymentId)).pipe(
        map((data) => ({ type: 'payment.updated', data: { paymentId, ...data } })),
      ),
      this.realtimeService.watch(paymentId),
    );
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('reconciliation')
  listPendingReconciliations() {
    return this.sepayService.listPendingReconciliations();
  }

  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Audit({ action: AuditAction.PAYMENT, entity: 'SepayTransaction' })
  @Post('reconciliation/:id/match')
  reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileSepayTransactionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.sepayService.reconcile(id, dto.invoiceCode, actor.userId);
  }

  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Delete('tickets/:paymentId')
  cancelTicket(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.sepayService.cancelTicket(paymentId);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('webhook')
  async webhook(
    @Body() dto: SepayWebhookDto,
    @Headers('authorization') authorization?: string,
  ): Promise<{ success: true; matched: boolean }> {
    this.sepayService.assertWebhookAuthorized(authorization);
    const result = await this.sepayService.handleWebhook(dto);
    return { success: true, matched: result.matched };
  }
}
