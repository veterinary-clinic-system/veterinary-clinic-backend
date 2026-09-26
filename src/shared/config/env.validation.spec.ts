import 'reflect-metadata';
import { validateEnv } from './env.validation';

const validConfig = {
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USERNAME: 'vetclinic',
  DB_PASSWORD: 'secret',
  DB_DATABASE: 'vetclinic',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_ACCESS_SECRET: 'access-secret-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters-long',
  AI_SERVICE_BASE_URL: 'http://localhost:8000',
  AI_SERVICE_TOKEN: 'ai-secret',
};

describe('validateEnv', () => {
  it('accepts configuration without optional SePay integration', () => {
    expect(() => validateEnv(validConfig)).not.toThrow();
  });

  it('rejects a partially configured SePay integration', () => {
    expect(() => validateEnv({ ...validConfig, SEPAY_ACCOUNT_NUMBER: '0123456789' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('accepts a complete SePay integration', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        SEPAY_ACCOUNT_NUMBER: '0123456789',
        SEPAY_BANK_CODE: 'VCB',
        SEPAY_API_KEY: 'webhook-secret',
        SEPAY_QR_ENDPOINT: 'https://vietqr.app/img',
      }),
    ).not.toThrow();
  });

  it('rejects weak or reused JWT secrets', () => {
    expect(() => validateEnv({ ...validConfig, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      'Invalid environment configuration',
    );
    expect(() =>
      validateEnv({
        ...validConfig,
        JWT_REFRESH_SECRET: validConfig.JWT_ACCESS_SECRET,
      }),
    ).toThrow('JWT secrets must be different');
  });

  it('rejects an invalid Swagger switch', () => {
    expect(() => validateEnv({ ...validConfig, ENABLE_SWAGGER: 'yes' })).toThrow(
      'Invalid environment configuration',
    );
  });
});
