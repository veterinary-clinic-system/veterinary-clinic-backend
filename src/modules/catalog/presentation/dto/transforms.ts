import { Transform } from 'class-transformer';

/**
 * Query-string booleans arrive as the strings "true"/"false" (or are omitted entirely).
 * This turns those into real booleans while leaving `undefined` alone so `@IsOptional()`
 * still applies, and passes anything else through unchanged so `@IsBoolean()` can reject
 * malformed input (e.g. `?active=maybe`).
 */
export function ParseOptionalBoolean(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  }) as PropertyDecorator;
}
