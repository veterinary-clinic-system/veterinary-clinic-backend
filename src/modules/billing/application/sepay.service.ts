import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Invoice } from '@/modules/billing/domain/entities/invoice.entity';
import { Payment } from '@/modules/billing/domain/entities/payment.entity';
import { InvoiceStatus } from '@/shared/common/enums/invoice-status.enum';
import { PaymentMethod } from '@/shared/common/enums/payment-method.enum';
import { PaymentStatus } from '@/shared/common/enums/payment-status.enum';
import { PaymentsService } from '@/modules/billing/application/payments.service';
import { SepayWebhookDto } from '@/modules/billing/presentation/dto/sepay-webhook.dto';

/** Ma QR tra ve cho giao dien - du de ve mot khoi "quet de tra tien". */
export interface SepayQrTicket {
  /** Dong `payments` dang cho tien ve. */
  paymentId: string;
  invoiceId: string;
  invoiceCode: string;
  amount: number;
  /** Anh VietQR da nhung san so tai khoan, so tien va noi dung. */
  qrImageUrl: string;
  /** Noi dung chuyen khoan - khach PHAI giu nguyen de doi soat tu dong chay duoc. */
  transferContent: string;
  accountNumber: string;
  bankCode: string;
}

/**
 * =====================================================================================
 * THANH TOAN QUA SePay (phan hoi nghiem thu: "De xuat lam chuc nang thanh toan bang
 * SePay").
 *
 * Luong khac han VNPay - khong co trang chuyen huong nao:
 *   1. Quay le tan (hoac chu nuoi) yeu cau ma QR cho mot hoa don -> `createQrTicket`
 *      ghi mot dong `payments` trang thai PENDING va sinh URL anh VietQR co san so
 *      tien + noi dung chuyen khoan.
 *   2. Khach quet ma bang ung dung ngan hang, tien vao THANG tai khoan phong kham.
 *   3. SePay doc bien dong so du va goi webhook ve `POST /billing/sepay/webhook`.
 *   4. `handleWebhook` doi chieu noi dung chuyen khoan voi ma hoa don roi chot dong
 *      `payments` do sang SUCCESS - `PaymentsService.syncStatus` tinh lai trang thai
 *      hoa don trong cung transaction.
 *
 * BA DIEU KHONG DUOC BO:
 *   - Webhook la cua CONG KHAI. No chi duoc tin khi header `Authorization: Apikey ...`
 *     khop `SEPAY_API_KEY`; thieu cau hinh thi tu choi tat.
 *   - `id` giao dich cua SePay duoc luu vao `reference_code` va kiem tra trung truoc
 *     khi ghi: SePay gui lai webhook khi khong nhan duoc 2xx, va mot lan gui lai khong
 *     duoc phep thanh mot lan thu tien thu hai.
 *   - Chi giao dich TIEN VAO (`transferType === 'in'`) duoc tinh.
 * =====================================================================================
 */
@Injectable()
export class SepayService {
  private readonly logger = new Logger(SepayService.name);

  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepository: Repository<Invoice>,
    @InjectRepository(Payment) private readonly paymentsRepository: Repository<Payment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  /** Cau hinh bat buoc - nem 500 co thong bao ro thay vi sinh ra mot ma QR vo dung. */
  private requireConfig(): { accountNumber: string; bankCode: string; qrEndpoint: string; prefix: string } {
    const accountNumber = this.configService.get<string>('payment.sepay.accountNumber');
    const bankCode = this.configService.get<string>('payment.sepay.bankCode');
    const qrEndpoint = this.configService.get<string>('payment.sepay.qrEndpoint')!;
    const prefix = this.configService.get<string>('payment.sepay.transferPrefix')!;

    if (!accountNumber || !bankCode) {
      throw new InternalServerErrorException(
        'Chưa cấu hình SEPAY_ACCOUNT_NUMBER / SEPAY_BANK_CODE - không thể tạo mã QR SePay',
      );
    }
    return { accountNumber, bankCode, qrEndpoint, prefix };
  }

  /**
   * Noi dung chuyen khoan cua mot hoa don.
   *
   * Chi giu chu va so: ngan hang cat dau va ky tu dac biet trong noi dung chuyen khoan
   * mot cach khong thong nhat, nen neu de nguyen thi chuoi ta so sanh va chuoi thuc su
   * ve trong webhook se lech nhau.
   */
  transferContentFor(invoiceCode: string): string {
    const { prefix } = this.requireConfig();
    return `${prefix}${invoiceCode.replace(/[^a-zA-Z0-9]/g, '')}`.toUpperCase();
  }

  /**
   * Mo mot lan cho thanh toan SePay cho hoa don. `amount` bo trong = toan bo so con
   * phai thu.
   *
   * Dung lai dong PENDING cu neu da co mot lan cho cung so tien: le tan bam "hien ma QR"
   * hai lan khong duoc tao ra hai khoan phai thu.
   */
  async createQrTicket(invoiceId: string, amount?: number): Promise<SepayQrTicket> {
    const { accountNumber, bankCode, qrEndpoint } = this.requireConfig();

    const invoice = await this.invoicesRepository.findOne({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Không tìm thấy hóa đơn');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Hóa đơn đã bị hủy');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Hóa đơn đã được thanh toán');
    }

    const balance = await this.paymentsService.balanceOf(invoiceId);
    const requested = amount ?? balance.outstandingAmount;
    if (requested <= 0) {
      throw new ConflictException('Hóa đơn không còn số dư phải thu');
    }
    if (requested > balance.outstandingAmount) {
      throw new ConflictException(
        `Số tiền vượt quá phần còn phải thu (${balance.outstandingAmount})`,
      );
    }

    const transferContent = this.transferContentFor(invoice.invoiceCode);

    const existing = await this.paymentsRepository.findOne({
      where: {
        invoiceId,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.QR,
        amount: requested,
      },
      order: { createdAt: 'DESC' },
    });

    const payment =
      existing ??
      (await this.paymentsService.record({
        invoiceId,
        amount: requested,
        method: PaymentMethod.QR,
        status: PaymentStatus.PENDING,
        referenceCode: transferContent,
        note: 'Chờ chuyển khoản qua SePay',
      }));

    const qrImageUrl =
      `${qrEndpoint}?acc=${encodeURIComponent(accountNumber)}` +
      `&bank=${encodeURIComponent(bankCode)}` +
      `&amount=${requested}` +
      `&des=${encodeURIComponent(transferContent)}`;

    return {
      paymentId: payment.id,
      invoiceId,
      invoiceCode: invoice.invoiceCode,
      amount: requested,
      qrImageUrl,
      transferContent,
      accountNumber,
      bankCode,
    };
  }

  /**
   * Kiem tra header `Authorization` cua webhook. SePay gui dang `Apikey <key>`.
   *
   * Tra ve void va nem 401 thay vi tra boolean: mot cho goi quen kiem tra ket qua se
   * mo toang cua webhook, con mot ngoai le thi khong the bo qua nham.
   */
  assertWebhookAuthorized(authorizationHeader?: string): void {
    const apiKey = this.configService.get<string>('payment.sepay.apiKey');
    if (!apiKey) {
      this.logger.error('SEPAY_API_KEY chưa được cấu hình - từ chối webhook');
      throw new UnauthorizedException('Webhook SePay chưa được cấu hình');
    }

    const provided = authorizationHeader?.replace(/^Apikey\s+/i, '').trim();
    if (!provided || provided !== apiKey) {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
  }

  /**
   * Xu ly mot bien dong so du do SePay bao ve.
   *
   * Tra ve `{ matched: false }` KEM ma 200 khi khong khop hoa don nao: SePay coi moi
   * ma khac 2xx la that bai va gui lai, ma mot khoan chuyen khoan khong lien quan toi
   * phong kham thi gui lai bao nhieu lan cung van khong khop.
   */
  async handleWebhook(dto: SepayWebhookDto): Promise<{ matched: boolean; paymentId?: string }> {
    if (dto.transferType !== 'in') {
      return { matched: false };
    }

    const content = `${dto.content ?? ''} ${dto.code ?? ''} ${dto.description ?? ''}`
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    if (!content) {
      return { matched: false };
    }

    const prefix = this.configService.get<string>('payment.sepay.transferPrefix')!.toUpperCase();
    const match = content.match(new RegExp(`${prefix}([A-Z0-9]+)`));
    if (!match) {
      this.logger.warn(`Webhook SePay ${dto.id}: nội dung không chứa mã hóa đơn`);
      return { matched: false };
    }

    const gatewayTransactionId = `sepay:${dto.id}`;

    return this.dataSource.transaction(async (manager) => {
      // Chong ghi trung khi SePay gui lai cung mot giao dich.
      const alreadyRecorded = await manager.findOne(Payment, {
        where: { referenceCode: gatewayTransactionId },
      });
      if (alreadyRecorded) {
        return { matched: true, paymentId: alreadyRecorded.id };
      }

      // `invoiceCode` cua ta co the chua dau gach noi, con noi dung chuyen khoan thi
      // khong - so sanh tren ban da chuan hoa cua ca hai phia.
      //
      // `startsWith` chu khong `===`: ngan hang co the noi them ky tu vao sau noi dung
      // (ma giao dich cua chinh ho), nen phan duoi ma hoa don khong phai luc nao cung
      // cat sach. Ma hoa don co do dai co dinh nen khong co chuyen mot ma la tien to
      // cua mot ma khac.
      const invoices = await manager.find(Invoice, {
        where: [{ status: InvoiceStatus.PENDING }, { status: InvoiceStatus.PARTIALLY_PAID }],
      });
      const invoice = invoices.find((candidate) =>
        match[1].startsWith(candidate.invoiceCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()),
      );

      if (!invoice) {
        this.logger.warn(`Webhook SePay ${dto.id}: không tìm thấy hóa đơn cho nội dung "${content}"`);
        return { matched: false };
      }

      const transferContent = this.transferContentFor(invoice.invoiceCode);

      // Uu tien chot dung dong PENDING da mo cho hoa don nay voi dung so tien.
      const pending = await manager.findOne(Payment, {
        where: {
          invoiceId: invoice.id,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.QR,
          referenceCode: transferContent,
          amount: dto.transferAmount,
        },
        order: { createdAt: 'ASC' },
      });

      if (pending) {
        await manager.update(Payment, pending.id, {
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
          referenceCode: gatewayTransactionId,
          note: `SePay ${dto.gateway ?? ''} · ${dto.referenceCode ?? ''}`.trim(),
        });
        await this.paymentsService.syncStatus(manager, invoice.id);
        return { matched: true, paymentId: pending.id };
      }

      // Khach chuyen so khac voi so ta mo san (tra thieu / tra thanh nhieu lan) - ghi
      // mot dong moi. `PaymentsService.record` van chan tra du.
      const payment = await this.paymentsService.record(
        {
          invoiceId: invoice.id,
          amount: dto.transferAmount,
          method: PaymentMethod.QR,
          status: PaymentStatus.SUCCESS,
          referenceCode: gatewayTransactionId,
          note: `SePay ${dto.gateway ?? ''} · ${dto.referenceCode ?? ''}`.trim(),
        },
        manager,
      );
      return { matched: true, paymentId: payment.id };
    });
  }

  /** Trang thai mot lan cho thanh toan - giao dien hoi lien tuc trong khi hien ma QR. */
  async getTicketStatus(paymentId: string): Promise<{ status: PaymentStatus; paidAt: Date | null }> {
    const payment = await this.paymentsRepository.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    return { status: payment.status, paidAt: payment.paidAt };
  }

  /** Huy mot lan cho (khach doi sang tra tien mat) de no khong chiem cho mai. */
  async cancelTicket(paymentId: string): Promise<void> {
    const payment = await this.paymentsRepository.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Chỉ hủy được giao dịch đang chờ chuyển khoản');
    }
    await this.paymentsRepository.update(paymentId, { status: PaymentStatus.FAILED });
  }
}
