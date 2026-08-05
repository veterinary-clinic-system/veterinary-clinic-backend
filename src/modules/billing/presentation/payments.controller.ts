import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { PaymentsService } from '@/modules/billing/application/payments.service';
import { QueryPaymentsDto } from './dto/query-payments.dto';

/**
 * Thanh toan - SRS muc 15 (`/api/payments`), FR-21.
 *
 * BE MAT NAY CHI DOC. Moi cach TAO ra mot dong thanh toan deu di kem mot nghiep vu khac
 * va nam o cho cua nghiep vu do: thu tien hoa don kham o `PATCH /billing/invoices/:id/pay`,
 * ban le o `POST /pos/carts/:id/checkout`, hoan tien o `POST /billing/invoices/:id/refund`.
 * Mot `POST /payments` chung chung se cho phep ghi tien vao hoa don ma khong di qua bat cu
 * phep kiem tra nghiep vu nao (tra du, hoa don da huy, tru kho khi ban) - dung cai ma
 * `PaymentsService` sinh ra de ngan.
 *
 * Doc thanh toan dung `INVOICE_VIEW`: ai xem duoc hoa don thi xem duoc cac lan tra cua no.
 * `PAYMENT_REFUND` (chi MANAGER/ADMIN) la quyen HANH DONG, nam o `BillingController`.
 */
@ApiTags('billing')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get()
  findAll(@Query() query: QueryPaymentsDto) {
    return this.paymentsService.findAll(query);
  }

  @RequirePermissions(Permission.INVOICE_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }
}
