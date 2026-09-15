import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { SepayTransaction } from '@/modules/billing/domain/entities/sepay-transaction.entity';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { User } from '@/modules/identity/domain/entities/user.entity';
import { Branch } from '@/modules/organization/domain/entities/branch.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { BillingController } from '@/modules/billing/presentation/billing.controller';
import { PaymentsController } from '@/modules/billing/presentation/payments.controller';
import { SepayController } from '@/modules/billing/presentation/sepay.controller';
import { BillingService } from '@/modules/billing/application/billing.service';
import { PaymentsService } from '@/modules/billing/application/payments.service';
import { SepayService } from '@/modules/billing/application/sepay.service';
import { PaymentRealtimeService } from '@/modules/billing/application/payment-realtime.service';
import { PAYMENT_PROVIDER } from '@/modules/billing/application/ports/payment.port';
import { ManualPaymentAdapter } from '@/modules/billing/infrastructure/payment/manual-payment.adapter';
import { VnpayPaymentAdapter } from '@/modules/billing/infrastructure/payment/vnpay-payment.adapter';
import { SepayPaymentAdapter } from '@/modules/billing/infrastructure/payment/sepay-payment.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Payment,
      SepayTransaction,
      Appointment,
      MedicalRecord,
      Item,
      Branch,
      User,
    ]),

    CatalogModule,

    NotificationModule,
  ],
  controllers: [BillingController, PaymentsController, SepayController],
  providers: [
    BillingService,
    PaymentsService,
    SepayService,
    PaymentRealtimeService,
    ManualPaymentAdapter,
    VnpayPaymentAdapter,
    SepayPaymentAdapter,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, ManualPaymentAdapter, VnpayPaymentAdapter, SepayPaymentAdapter],
      useFactory: (
        config: ConfigService,
        manual: ManualPaymentAdapter,
        vnpay: VnpayPaymentAdapter,
        sepay: SepayPaymentAdapter,
      ) => {
        switch (config.get<string>('payment.provider')) {
          case 'vnpay':
            return vnpay;
          case 'sepay':
            return sepay;
          default:
            return manual;
        }
      },
    },
  ],
  exports: [BillingService, PaymentsService, SepayService],
})
export class BillingModule {}
