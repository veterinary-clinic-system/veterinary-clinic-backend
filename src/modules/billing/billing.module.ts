import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { Examination } from '@/modules/clinical/domain/entities/examination.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { BillingController } from '@/modules/billing/presentation/billing.controller';
import { BillingService } from '@/modules/billing/application/billing.service';
import { PAYMENT_PROVIDER } from '@/modules/billing/application/ports/payment.port';
import { ManualPaymentAdapter } from '@/modules/billing/infrastructure/payment/manual-payment.adapter';
import { VnpayPaymentAdapter } from '@/modules/billing/infrastructure/payment/vnpay-payment.adapter';

/**
 * Billing module - generates and manages Invoices for appointments. `Appointment` and
 * `Examination` are only ever read here (to assemble invoice lines from the service
 * booked plus whatever prescriptions/lab tests an exam produced) - both are owned by
 * their own modules. `Item` is read directly (not via the catalog module's service) to
 * resolve unit prices and to match lab test orders to a priced catalog entry.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, Appointment, Examination, Item])],
  controllers: [BillingController],
  providers: [
    BillingService,
    ManualPaymentAdapter,
    VnpayPaymentAdapter,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, ManualPaymentAdapter, VnpayPaymentAdapter],
      useFactory: (
        config: ConfigService,
        manual: ManualPaymentAdapter,
        vnpay: VnpayPaymentAdapter,
      ) => (config.get<string>('payment.provider') === 'vnpay' ? vnpay : manual),
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
