import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment, Examination, Invoice, InvoiceItem, Item } from '@/database/entities';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

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
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
