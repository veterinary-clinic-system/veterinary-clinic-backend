import { resolveSwaggerEnabled } from './app.config';

describe('app config', () => {
  it('disables Swagger by default in production', () => {
    expect(resolveSwaggerEnabled('production', undefined)).toBe(false);
  });

  it('keeps Swagger available by default outside production', () => {
    expect(resolveSwaggerEnabled('development', undefined)).toBe(true);
    expect(resolveSwaggerEnabled('test', undefined)).toBe(true);
  });

  it('allows an explicit valid override', () => {
    expect(resolveSwaggerEnabled('production', 'true')).toBe(true);
    expect(resolveSwaggerEnabled('development', 'false')).toBe(false);
  });
});
