import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface CapturedResponse {
  status: number;
  body: Record<string, unknown>;
}

/** `ArgumentsHost` gia lap - chi can hai thu bo loc thuc su dung toi. */
function hostFor(url: string, captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };

  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
}

function run(exception: unknown, url = '/api/v1/test'): CapturedResponse {
  const captured: CapturedResponse = { status: 0, body: {} };
  new AllExceptionsFilter().catch(exception, hostFor(url, captured));
  return captured;
}

/**
 * SRS muc 17 - MOT dinh dang loi cho toan he thong (P10-T8).
 *
 * Bo test nay khoa lai chinh hop dong voi SRS: ba truong `code`/`message`/`timestamp`
 * phai co mat o MOI loai loi. No cung khoa lai dieu quan trong hon - loi ngoai du kien
 * khong duoc phep de lo noi dung that ra ngoai.
 */
describe('AllExceptionsFilter', () => {
  it('luôn trả đủ ba trường của SRS mục 17', () => {
    const { body } = run(new NotFoundException('Không tìm thấy thú cưng'));

    expect(body).toHaveProperty('code');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('timestamp');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp as string).toString()).not.toBe('Invalid Date');
  });

  it.each([
    [new BadRequestException('x'), HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR'],
    [new ForbiddenException('x'), HttpStatus.FORBIDDEN, 'FORBIDDEN'],
    [new NotFoundException('x'), HttpStatus.NOT_FOUND, 'NOT_FOUND'],
    [new ConflictException('x'), HttpStatus.CONFLICT, 'CONFLICT'],
  ])('suy ra mã lỗi từ mã trạng thái HTTP', (exception, status, code) => {
    const captured = run(exception);
    expect(captured.status).toBe(status);
    expect(captured.body.code).toBe(code);
  });

  it('ưu tiên mã lỗi do service tự đặt', () => {
    const { body } = run(
      new ConflictException({ code: 'SLOT_TAKEN', message: 'Khung giờ vừa bị đặt mất' }),
    );

    expect(body.code).toBe('SLOT_TAKEN');
    expect(body.message).toBe('Khung giờ vừa bị đặt mất');
  });

  it('giữ nguyên mảng lỗi từng trường của ValidationPipe', () => {
    const { body } = run(
      new BadRequestException({
        message: ['phone không hợp lệ', 'startAt phải là ngày ISO 8601'],
      }),
    );

    // Noi thanh mot chuoi o day se lam giao dien khong gan duoc tung loi vao dung o nhap.
    expect(body.message).toEqual(['phone không hợp lệ', 'startAt phải là ngày ISO 8601']);
  });

  it('giữ lại các trường phụ do ngoại lệ cố ý gửi kèm', () => {
    const { body } = run(
      new HttpException(
        { message: 'Đang chờ thanh toán', redirectUrl: 'https://vnpay.test/pay/abc' },
        HttpStatus.PAYMENT_REQUIRED,
      ),
    );

    expect(body.redirectUrl).toBe('https://vnpay.test/pay/abc');
  });

  it('KHÔNG để lộ nội dung của lỗi ngoài dự kiến', () => {
    // Thong diep nay mo phong mot loi tho cua TypeORM: no chua ten bang va cau SQL.
    const leaky = new Error(
      'insert into "users" ("password_hash") values ($1) - duplicate key value violates unique constraint',
    );
    leaky.stack = 'Error: ...\n  at Repository.insert (/app/node_modules/typeorm/...)';

    const { status, body } = run(leaky);

    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.code).toBe('INTERNAL_ERROR');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('typeorm');
    expect(serialized).not.toContain('node_modules');
  });
});
