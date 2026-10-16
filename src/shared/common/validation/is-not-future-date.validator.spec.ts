import { validate } from 'class-validator';
import { IsNotFutureDate, isNotFutureDate } from './is-not-future-date.validator';

describe('isNotFutureDate', () => {
  const today = new Date(2026, 9, 16, 23, 30);

  it('chấp nhận hôm qua và chính hôm nay', () => {
    expect(isNotFutureDate('2026-10-15', today)).toBe(true);
    expect(isNotFutureDate('2026-10-16', today)).toBe(true);
    expect(isNotFutureDate('2026-10-16T00:00:00.000Z', today)).toBe(true);
  });

  it('từ chối ngày mai trở đi', () => {
    expect(isNotFutureDate('2026-10-17', today)).toBe(false);
    expect(isNotFutureDate('2027-05-01', today)).toBe(false);
  });

  it('bỏ qua giá trị không phải chuỗi ngày để IsDateString tự báo lỗi', () => {
    expect(isNotFutureDate(undefined, today)).toBe(true);
    expect(isNotFutureDate('abc', today)).toBe(true);
  });

  it('decorator gắn vào DTO báo đúng thông điệp', async () => {
    class Dto {
      @IsNotFutureDate({ message: 'Ngày sinh không được sau hôm nay' })
      birthDate?: string;
    }
    const dto = Object.assign(new Dto(), { birthDate: '2999-01-01' });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toEqual({ isNotFutureDate: 'Ngày sinh không được sau hôm nay' });
  });
});
