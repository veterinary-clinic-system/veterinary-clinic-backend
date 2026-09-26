import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string;

  @IsIn(['true', 'false'])
  @IsOptional()
  ENABLE_SWAGGER: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsInt()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsOptional()
  @IsString()
  @Matches(/^rediss?:\/\/\S+$/, {
    message: 'REDIS_URL must start with redis:// or rediss://',
  })
  REDIS_URL: string;

  @ValidateIf((environment: EnvironmentVariables) => !environment.REDIS_URL)
  @IsString()
  REDIS_HOST: string;

  @ValidateIf((environment: EnvironmentVariables) => !environment.REDIS_URL)
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsString()
  AI_SERVICE_BASE_URL: string;

  @IsString()
  AI_SERVICE_TOKEN: string;

  @IsIn(['http', 'stub'])
  @IsOptional()
  AI_PROVIDER: string;

  @IsIn(['cloudinary'])
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    return value.trim().toLowerCase() || undefined;
  })
  STORAGE_PROVIDER: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_URL: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET: string;

  @IsString()
  @IsOptional()
  CLOUDINARY_FOLDER: string;

  @IsIn(['manual', 'vnpay', 'sepay'])
  @IsOptional()
  PAYMENT_PROVIDER: string;

  @IsOptional()
  @IsString()
  REPORT_TIMEZONE: string;

  @ValidateIf(
    (environment: EnvironmentVariables) =>
      !!(
        environment.SEPAY_ACCOUNT_NUMBER ||
        environment.SEPAY_BANK_CODE ||
        environment.SEPAY_API_KEY
      ),
  )
  @IsString()
  @Matches(/\S/)
  SEPAY_ACCOUNT_NUMBER: string;

  @ValidateIf(
    (environment: EnvironmentVariables) =>
      !!(
        environment.SEPAY_ACCOUNT_NUMBER ||
        environment.SEPAY_BANK_CODE ||
        environment.SEPAY_API_KEY
      ),
  )
  @IsString()
  @Matches(/\S/)
  SEPAY_BANK_CODE: string;

  @ValidateIf(
    (environment: EnvironmentVariables) =>
      !!(
        environment.SEPAY_ACCOUNT_NUMBER ||
        environment.SEPAY_BANK_CODE ||
        environment.SEPAY_API_KEY
      ),
  )
  @IsString()
  @Matches(/\S/)
  SEPAY_API_KEY: string;

  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/\S+$/, { message: 'SEPAY_QR_ENDPOINT must be an HTTP(S) URL' })
  SEPAY_QR_ENDPOINT: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }

  if (validated.JWT_ACCESS_SECRET === validated.JWT_REFRESH_SECRET) {
    throw new Error('Invalid environment configuration:\nJWT secrets must be different');
  }

  return validated;
}
