import { HttpException, HttpStatus } from '@nestjs/common';

export class PaymentPendingException extends HttpException {
  constructor(redirectUrl: string) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message: 'Hoá đơn đang chờ thanh toán tại cổng thanh toán',
        redirectUrl,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
