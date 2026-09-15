import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

const RESERVED_BODY_KEYS = new Set(['statusCode', 'error', 'message', 'code']);

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
