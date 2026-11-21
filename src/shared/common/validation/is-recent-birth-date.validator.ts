import { ValidationOptions, registerDecorator } from 'class-validator';

/** Thú cưng sống lâu nhất (rùa, vẹt) vẫn hiếm khi quá con số này - xa hơn gần như chắc là gõ nhầm. */
export const MAX_PET_AGE_YEARS = 40;

/**
 * Ngày sinh không được sớm hơn `MAX_PET_AGE_YEARS` năm trước - chặn "sinh năm 1800" (226 tuổi).
 * Định dạng sai để IsDateString báo, ở đây chỉ xét khoảng.
 */
export function isRecentBirthDate(value: unknown, today: Date = new Date()): boolean {
  if (typeof value !== 'string' || value.length < 10) return true;
  const year = Number(value.slice(0, 4));
  if (!Number.isFinite(year)) return true;
  const pad = (n: number) => String(n).padStart(2, '0');
  const earliest = `${today.getFullYear() - MAX_PET_AGE_YEARS}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return value.slice(0, 10) >= earliest;
}

export function IsRecentBirthDate(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isRecentBirthDate',
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: { validate: (value: unknown) => isRecentBirthDate(value) },
    });
  };
}
