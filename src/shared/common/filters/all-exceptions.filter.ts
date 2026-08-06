import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Ma loi theo tung ma trang thai HTTP - SRS muc 17 (P10-T8).
 *
 * `code` la chuoi ON DINH danh cho MAY DOC, con `message` danh cho nguoi doc. Do la ly
 * do khong dung thang con so HTTP lam `code`: giao dien can phan biet "so dien thoai da
 * ton tai" voi "khung gio vua bi dat mat" de hien hai cach xu ly khac nhau, ma ca hai
 * deu la 409. Chuoi cho phep noi rong ve sau; con so thi khong.
 */
const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const FALLBACK_CODE = 'INTERNAL_ERROR';

/**
 * Cac khoa da duoc phan hoi tu dat, khong duoc phep chep de tu than ngoai le.
 *
 * `statusCode` va `error` la hai truong Nest tu them vao than cua `HttpException`; giu
 * chung lai se lam moi phan hoi loi mang hai cach goi cung mot thu (`code` cua SRS va
 * `statusCode` cua Nest), va nguoi viet giao dien se phai doan xem doc cai nao.
 */
const RESERVED_BODY_KEYS = new Set(['statusCode', 'error', 'message', 'code']);

/**
 * Mot dinh dang loi duy nhat cho toan he thong - SRS muc 17.
 *
 * Hinh dang: `{ code, message, timestamp, path }`. Ba truong dau la yeu cau cua muc 17;
 * `path` giu lai vi no la thu dau tien can toi khi doi chieu mot bao loi cua nguoi dung
 * voi log may chu, va no khong he lo gi ma nguoi goi chua biet (ho vua goi chinh no).
 *
 * KHONG BAO GIO TRA STACK TRACE hay thong diep loi tho ra ngoai. Mot loi khong phai
 * `HttpException` la loi ngoai du kien - thong diep cua no thuong chua ten bang, cau
 * SQL hoac duong dan tep tren may chu. Nhung thu do di vao log ung dung (co xac thuc
 * bao ve), con nguoi goi chi nhan `INTERNAL_ERROR`. Dieu nay dung o MOI moi truong chu
 * khong rieng production: mot lap trinh vien can chi tiet thi doc log, va giu hai duong
 * di khac nhau giua dev va production la cach chac chan de mot ngay nao do lo that.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      code: this.resolveCode(exception, status),
      message: this.resolveMessage(exception, isHttpException),
      timestamp: new Date().toISOString(),
      path: request.url,
      ...this.extraFields(exception, isHttpException),
    });
  }

  /**
   * Cac truong rieng ma mot ngoai le co chu dich gui kem, vi du `redirectUrl` cua
   * `PaymentPendingException`.
   *
   * Khong co doan nay thi bo loc se lang le NUOT chung: `PaymentPendingException` van
   * tra 402 dung nhu cu nhung mat dia chi cong thanh toan, va luong tra tien truc tuyen
   * hong theo mot cach khong co dau vet nao trong log. Chi cac ngoai le TU KHAI mot
   * doi tuong moi di qua day - loi he thong ngoai du kien khong bao gio co truong phu.
   */
  private extraFields(exception: unknown, isHttpException: boolean): Record<string, unknown> {
    if (!isHttpException) {
      return {};
    }

    const body = (exception as HttpException).getResponse();
    if (typeof body !== 'object' || body === null) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>).filter(
        ([key]) => !RESERVED_BODY_KEYS.has(key),
      ),
    );
  }

  /**
   * Ma loi. Service duoc quyen tu dat ma rieng bang cach nem
   * `new ConflictException({ code: 'SLOT_TAKEN', message: '...' })`; khong dat thi suy
   * ra tu ma trang thai HTTP.
   */
  private resolveCode(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const code = (body as Record<string, unknown>).code;
        if (typeof code === 'string') {
          return code;
        }
      }
    }
    return CODE_BY_STATUS[status] ?? FALLBACK_CODE;
  }

  /**
   * Thong diep cho nguoi doc.
   *
   * `ValidationPipe` tra `message` la MOT MANG cac loi tung truong. Giu nguyen mang do
   * chu khong noi thanh mot chuoi: giao dien can gan tung loi vao dung o nhap cua no,
   * va mot chuoi da noi thi khong tach nguoc ra duoc.
   */
  private resolveMessage(exception: unknown, isHttpException: boolean): string | string[] {
    if (!isHttpException) {
      return 'Đã xảy ra lỗi hệ thống, vui lòng thử lại.';
    }

    const httpException = exception as HttpException;
    const body = httpException.getResponse();

    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object' && body !== null) {
      const message = (body as Record<string, unknown>).message;
      if (typeof message === 'string' || Array.isArray(message)) {
        return message as string | string[];
      }
    }
    return httpException.message;
  }
}
