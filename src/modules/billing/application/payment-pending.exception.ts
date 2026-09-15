import { HttpException, HttpStatus } from '@nestjs/common';

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
