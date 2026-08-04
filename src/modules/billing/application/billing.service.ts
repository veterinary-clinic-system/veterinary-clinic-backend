import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { InvoiceItem } from '@/modules/billing/domain/entities/invoice-item.entity';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Item } from '@/modules/catalog/domain/entities/item.entity';
import { MedicalRecord } from '@/modules/clinical/domain/entities/medical-record.entity';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { ItemType } from '@/shared/common/enums/item-type.enum';
import { PaginatedResultDto } from '@/shared/common/dto/paginated-result.dto';
import { PayInvoiceDto } from '@/modules/billing/presentation/dto/pay-invoice.dto';
import { QueryInvoicesDto } from '@/modules/billing/presentation/dto/query-invoices.dto';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '@/modules/billing/application/ports/payment.port';
import { PaymentPendingException } from '@/modules/billing/application/payment-pending.exception';

/** Full detail relations for a single-invoice read (generate/get/pay/by-appointment). */
const INVOICE_DETAIL_RELATIONS = ['items', 'items.item', 'appointment'];

/** Columns the list endpoint is allowed to sort by - keeps `?sortBy=` from reaching raw SQL. */
const SORTABLE_COLUMNS = new Set(['createdAt', 'updatedAt', 'paid', 'paidAt']);

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
    // Appointment/Examination are only ever read here through the transaction manager
    // (see generateForAppointment) - only Item needs its own repository, per spec, for
    // the lab-test-to-catalog-item lookup.
    @InjectRepository(Item) private readonly itemsRepository: Repository<Item>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  /**
   * Generates the Invoice for an appointment from whatever billable records exist for
   * it right now: the booked Service (always), plus - if a doctor has already written
   * up an Examination for the visit - one line per prescribed medication and one per
   * ordered lab test. Idempotent: calling this again after the invoice already exists
   * just returns it unchanged rather than erroring or duplicating lines.
   *
   * Wrapped in a single transaction, guarded by a per-appointment Postgres advisory
   * lock (same pattern as AppointmentsService.createBooking/update) so two concurrent
   * "generate invoice" calls for the same appointment can't both pass the
   * already-exists check and insert duplicate invoices.
   */
  async generateForAppointment(appointmentId: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [appointmentId]);

      const existing = await manager.findOne(Invoice, {
        where: { appointmentId },
        relations: INVOICE_DETAIL_RELATIONS,
      });
      if (existing) {
        return existing;
      }

      const appointment = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        // `service.item` is technically eager on Service already (see service.entity.ts)
        // but is listed explicitly anyway - mirrors the convention already established
        // in appointments.service.ts's own `findOne`.
        relations: ['service', 'service.item'],
      });
      if (!appointment) {
        throw new NotFoundException('Appointment not found');
      }

      // Ho so benh an la TUY CHON - van lap duoc hoa don cho mot lan kham dich vu don
      // thuan (chi dong dich vu) truoc khi bac si ghi bat cu thu gi.
      //
      // Tu P4-T6 doc qua `MedicalRecord` chu khong qua `Examination`: khoa ngoai cua
      // don thuoc/xet nghiem da chuyen sang ho so. Ket qua ve tien KHONG DOI voi du
      // lieu cu - backfill sinh dung mot ho so cho moi phieu kham, nen cung tap don
      // thuoc va cung tap chi dinh xet nghiem di vao hoa don nhu truoc.
      const medicalRecord = await manager.findOne(MedicalRecord, {
        where: { appointmentId },
        relations: [
          'prescriptions',
          'prescriptions.items',
          'prescriptions.items.medication',
          'prescriptions.items.medication.item',
          'labTestOrders',
        ],
      });

      const lines: Array<{ itemId: string; price: number; quantity: number }> = [];

      // (a) the booked service itself - always billed, one line, quantity 1.
      lines.push({
        itemId: appointment.service.item.id,
        price: appointment.service.item.unitPrice,
        quantity: 1,
      });

      // (b) one line per prescribed medication across every prescription on the record.
      if (medicalRecord) {
        for (const prescription of medicalRecord.prescriptions ?? []) {
          for (const prescriptionItem of prescription.items ?? []) {
            lines.push({
              itemId: prescriptionItem.medication.item.id,
              price: prescriptionItem.medication.item.unitPrice,
              // ASSUMPTION: medications are billed per day of the prescribed course, i.e.
              // quantity = durationDays, not a per-dose unit count (tablets/ml actually
              // dispensed). PrescriptionItem only stores a free-text `dosage` string
              // (e.g. "1 tablet twice a day") with no structured frequency field to
              // multiply out, so `durationDays` is the only structured quantity signal
              // available to bill against.
              quantity: prescriptionItem.durationDays,
            });
          }
        }

        // (c) one line per ordered lab test, resolved against the Item catalog by name.
        // Catalog rows aren't written anywhere in this transaction, so a plain
        // (non-transactional) repository read is fine here.
        for (const labTestOrder of medicalRecord.labTestOrders ?? []) {
          const matchedItem = await this.itemsRepository.findOne({
            where: { itemType: ItemType.LAB_TEST, itemName: ILike(labTestOrder.testName) },
          });
          if (matchedItem) {
            lines.push({ itemId: matchedItem.id, price: matchedItem.unitPrice, quantity: 1 });
          } else {
            // ASSUMPTION: a lab test ordered without a matching priced catalog Item
            // (name typo, or a test type the price list hasn't caught up with yet)
            // should not block the rest of the invoice from being generated - it's
            // just skipped and logged so billing staff can follow up manually.
            this.logger.warn(
              `No active LAB_TEST item matches lab test order "${labTestOrder.testName}" ` +
                `(order ${labTestOrder.id}) on appointment ${appointmentId} - skipping this line`,
            );
          }
        }
      }

      const invoice = manager.create(Invoice, {
        appointmentId,
        paid: false,
        paymentMethod: null,
        paidAt: null,
        // Invoice.items has { cascade: true } (see invoice.entity.ts), so saving the
        // Invoice with `items` populated inserts the Invoice and every InvoiceItem in
        // one go - same pattern ExaminationsService uses for Prescription + its items.
        items: lines.map((line) => manager.create(InvoiceItem, line)),
      });
      const saved = await manager.save(invoice);

      return manager.findOne(Invoice, {
        where: { id: saved.id },
        relations: INVOICE_DETAIL_RELATIONS,
      }) as Promise<Invoice>;
    });
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: INVOICE_DETAIL_RELATIONS,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  /**
   * Lookup by appointment id instead of invoice id, for callers that only know the
   * appointment (e.g. "has this visit been billed yet?"). Returns `null` rather than
   * throwing when no invoice exists yet - this is a routine "not generated yet" state,
   * not an error, so callers get a clean `null` body instead of having to catch a 404.
   */
  async findByAppointment(appointmentId: string): Promise<Invoice | null> {
    return this.invoicesRepository.findOne({
      where: { appointmentId },
      relations: INVOICE_DETAIL_RELATIONS,
    });
  }

  /**
   * Paginated list backing a billing staff table view. Filtering/sorting/pagination all
   * run against a query builder that only *joins* (not selects) `appointment`, because
   * `invoice.items` is a to-many relation - `leftJoinAndSelect`-ing it directly here
   * would make Postgres' LIMIT/OFFSET apply to the joined item rows instead of distinct
   * invoices, silently truncating results. Instead the filtered/sorted page of invoice
   * ids is resolved first, then the full entity graph is re-fetched for just those ids.
   */
  async findAll(query: QueryInvoicesDto): Promise<PaginatedResultDto<Invoice>> {
    const qb = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoin('invoice.appointment', 'appointment');

    if (query.branchId) {
      qb.andWhere('appointment.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.paid !== undefined) {
      qb.andWhere('invoice.paid = :paid', { paid: query.paid });
    }

    const sortBy = query.sortBy && SORTABLE_COLUMNS.has(query.sortBy) ? query.sortBy : 'createdAt';
    qb.orderBy(`invoice.${sortBy}`, query.sortOrder ?? 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [pageRows, total] = await qb.getManyAndCount();
    const ids = pageRows.map((invoice) => invoice.id);

    const detailed = ids.length
      ? await this.invoicesRepository.find({
          where: { id: In(ids) },
          relations: INVOICE_DETAIL_RELATIONS,
        })
      : [];
    const byId = new Map(detailed.map((invoice) => [invoice.id, invoice]));
    const data = ids.map((id) => byId.get(id)!);

    return new PaginatedResultDto(data, total, query.page, query.limit);
  }

  /**
   * Ghi nhan thanh toan cho hoa don, di qua port PaymentProvider.
   *
   * Chi danh dau `paid` khi cong thanh toan bao da thu duoc tien (`settled`). Voi
   * adapter thu tien tai quay thi dieu do dung ngay lap tuc; voi cong truc tuyen
   * (VNPay) thi hoa don van o trang thai chua thanh toan cho den khi cong goi lai
   * IPN - tra ve `redirectUrl` de nguoi dung sang trang thanh toan.
   */
  async pay(id: string, dto: PayInvoiceDto): Promise<Invoice> {
    const invoice = await this.invoicesRepository.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.paid) {
      throw new ConflictException('This invoice has already been paid');
    }

    const amount = (invoice.items ?? []).reduce(
      (sum, line) => sum + Number(line.price) * line.quantity,
      0,
    );

    const result = await this.paymentProvider.charge({
      invoiceId: invoice.id,
      amount,
      method: dto.paymentMethod,
    });

    if (!result.settled) {
      throw new PaymentPendingException(result.redirectUrl!);
    }

    await this.invoicesRepository.update(id, {
      paid: true,
      paidAt: new Date(),
      paymentMethod: dto.paymentMethod,
    });

    return this.findOne(id);
  }
}
