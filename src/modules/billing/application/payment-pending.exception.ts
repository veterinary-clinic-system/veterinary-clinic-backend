import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Nem ra khi cong thanh toan truc tuyen chua thu duoc tien va can nguoi dung thao tac
 * tiep tren trang cua cong.
 *
 * Dung ma 402 Payment Required kem `redirectUrl` thay vi tra ve Invoice nhu duong di
 * binh thuong: hoa don CHUA duoc thanh toan, tra ve no nhu the da xong se khien
 * frontend hien thi sai trang thai. Voi adapter thu tien tai quay (mac dinh) thi
 * ngoai le nay khong bao gio xay ra, nen hop dong API cu giu nguyen.
 */
export class PaymentPendingException extends HttpException {
  constructor(redirectUrl: string) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: 'Hoa don dang cho thanh toan tai cong thanh toan',
        redirectUrl,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
