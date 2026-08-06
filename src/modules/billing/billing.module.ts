import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { BillingController } from '@/modules/billing/presentation/billing.controller';
import { PaymentsController } from '@/modules/billing/presentation/payments.controller';
import { BillingService } from '@/modules/billing/application/billing.service';
import { PaymentsService } from '@/modules/billing/application/payments.service';
import { PAYMENT_PROVIDER } from '@/modules/billing/application/ports/payment.port';
import { ManualPaymentAdapter } from '@/modules/billing/infrastructure/payment/manual-payment.adapter';
import { VnpayPaymentAdapter } from '@/modules/billing/infrastructure/payment/vnpay-payment.adapter';

/**
 * Billing module - generates and manages Invoices for appointments. `Appointment` and
 * `MedicalRecord` are only ever read here (to assemble invoice lines from the service
 * booked plus whatever prescriptions/lab tests the visit produced) - both are owned by
 * their own modules. `Item` is read directly (not via the catalog module's service) to
 * resolve unit prices and to match lab test orders to a priced catalog entry.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Payment,
      Appointment,
      MedicalRecord,
      Item,
      Branch,
      User,
    ]),
    // Hoan tien mot hoa don POS phai tra hang ve kho (P8-T3) - di qua barrel
    // `catalog/application`, cua duy nhat de dung toi ton kho.
    CatalogModule,
    // Thanh toan that bai bao cho le tan/quan ly qua hop thu trong ung dung (P10-T5).
    NotificationModule,
  ],
  controllers: [BillingController, PaymentsController],
  providers: [
    BillingService,
    PaymentsService,
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
  exports: [BillingService, PaymentsService],
})
export class BillingModule {}
