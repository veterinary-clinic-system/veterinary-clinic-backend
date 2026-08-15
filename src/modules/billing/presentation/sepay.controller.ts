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

/**
 * Thanh toan chuyen khoan qua SePay.
 *
 * Tach khoi `BillingController` vi mot trong ba cua o day la CONG KHAI (webhook cua
 * SePay khong mang JWT nao ca) - de chung lan voi cac route can quyen se rat de mot
 * lan sua sau nay lam ho hang rao.
 */
@ApiTags('billing')
@Controller('billing/sepay')
export class SepayController {
  constructor(private readonly sepayService: SepayService) {}

  /** Mo mot lan cho chuyen khoan va lay ma QR de khach quet. */
  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Audit({ action: AuditAction.PAYMENT, entity: 'Invoice' })
  @Post('invoices/:id/qr')
  createQr(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('amount') amount?: string,
  ) {
    return this.sepayService.createQrTicket(id, amount ? Number(amount) : undefined);
  }

  /** Giao dien hoi lien tuc trong khi hien ma QR de biet tien da ve chua. */
  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get('tickets/:paymentId')
  getTicket(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.sepayService.getTicketStatus(paymentId);
  }

  /** Khach doi sang tra tien mat - dong lan cho lai de no khong treo mai. */
  @RequirePermissions(Permission.PAYMENT_CREATE)
  @Delete('tickets/:paymentId')
  cancelTicket(@Param('paymentId', ParseUUIDPipe) paymentId: string) {
    return this.sepayService.cancelTicket(paymentId);
  }

  /**
   * Webhook cua SePay - CONG KHAI, khong co JWT.
   *
   * Hang rao la header `Authorization: Apikey <SEPAY_API_KEY>`, duoc kiem tra TRUOC khi
   * dung toi than request. Throttle de mot ben thu ba khong the dung cua nay lam kenh
   * do khoa.
   *
   * Luon tra 200 khi da qua duoc buoc xac thuc, ke ca khi khong khop hoa don nao: SePay
   * coi moi ma khac 2xx la that bai va se gui lai, ma mot khoan chuyen khoan khong lien
   * quan thi gui lai bao nhieu lan cung khong khop.
   */
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
