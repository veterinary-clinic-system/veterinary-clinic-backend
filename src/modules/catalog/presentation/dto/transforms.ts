import { Transform } from 'class-transformer';

export function ParseOptionalBoolean(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }) as PropertyDecorator;
}
