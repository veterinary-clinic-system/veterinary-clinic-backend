import { ValidationOptions, registerDecorator } from 'class-validator';

/**
 * Ngày (YYYY-MM-DD hoặc ISO) không được sau hôm nay — dùng cho ngày sinh thú cưng.
 * So theo ngày lịch (bỏ giờ) để "hôm nay" luôn hợp lệ bất kể múi giờ của máy chủ.
 */
export function isNotFutureDate(value: unknown, today: Date = new Date()): boolean {
  if (typeof value !== 'string' || value.length < 10) return true; // để IsDateString báo lỗi định dạng
  const day = value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return day <= todayStr;
}

export function IsNotFutureDate(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: { validate: (value: unknown) => isNotFutureDate(value) },
    });
  };
}
