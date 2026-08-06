import { ValidationError } from '@nestjs/common';
import { formatValidationErrors } from './validation-error.formatter';

function error(property: string, constraints: Record<string, string>): ValidationError {
  return { property, constraints } as ValidationError;
}

function messagesOf(errors: ValidationError[]): string[] {
  const response = formatValidationErrors(errors).getResponse();
  return (response as { message: string[] }).message;
}

/**
 * SRS muc 16 - thong diep loi phai noi dung cai nguoi nhap can sua (P10-T8).
 *
 * Bo test nay khoa lai chinh cai loi da tim ra khi chay tay muc 22: mot truong bat buoc
 * bo trong tra ve "note không được vượt quá 500 ký tự".
 */
describe('formatValidationErrors', () => {
  it('một thông điệp cho mỗi trường', () => {
    const messages = messagesOf([
      error('phone', { isPhoneNumber: 'Số điện thoại không đúng định dạng' }),
      error('fullName', { isNotEmpty: 'Vui lòng nhập họ tên' }),
    ]);

    expect(messages).toEqual(['Số điện thoại không đúng định dạng', 'Vui lòng nhập họ tên']);
  });

  it('trường bỏ trống báo "thiếu giá trị" chứ không báo giới hạn độ dài', () => {
    // Mot truong `note: string` bat buoc, bo trong: class-validator lam hong CA BA luat
    // cung luc. Chon nham thi nguoi dung nhan mot cau vo nghia.
    const messages = messagesOf([
      error('note', {
        maxLength: 'note must be shorter than or equal to 500 characters',
        isString: 'note must be a string',
      }),
    ]);

    expect(messages).toEqual(['note must be a string']);
  });

  it('ưu tiên isNotEmpty hơn mọi luật khác', () => {
    const messages = messagesOf([
      error('reason', {
        maxLength: 'reason quá dài',
        minLength: 'reason quá ngắn',
        isString: 'reason phải là chuỗi',
        isNotEmpty: 'Phải nêu lý do',
      }),
    ]);

    expect(messages).toEqual(['Phải nêu lý do']);
  });

  it('không phụ thuộc vào thứ tự khai báo decorator', () => {
    // Cung mot tap luat, chi khac thu tu khoa trong object - ket qua phai giong nhau.
    const a = messagesOf([error('x', { isNotEmpty: 'thiếu', maxLength: 'quá dài' })]);
    const b = messagesOf([error('x', { maxLength: 'quá dài', isNotEmpty: 'thiếu' })]);

    expect(a).toEqual(b);
    expect(a).toEqual(['thiếu']);
  });

  it('đi vào DTO lồng nhau', () => {
    const parent = {
      property: 'newPet',
      constraints: undefined,
      children: [error('breedId', { isUuid: 'breedId phải là UUID' })],
    } as unknown as ValidationError;

    expect(messagesOf([parent])).toEqual(['breedId phải là UUID']);
  });

  it('luật lạ vẫn được báo khi nó là luật duy nhất', () => {
    const messages = messagesOf([error('code', { customRule: 'Mã hàng đã tồn tại' })]);
    expect(messages).toEqual(['Mã hàng đã tồn tại']);
  });
});
