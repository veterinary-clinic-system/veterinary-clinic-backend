import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
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

  @IsString()
  @IsOptional()
  S3_BUCKET: string;

  @IsString()
  @IsOptional()
  S3_REGION: string;

  @IsUrl({ require_tld: false, protocols: ['https', 'http'], require_protocol: true })
  @IsOptional()
  // Để trống (máy dev, CI) = chưa cấu hình S3, không phải URL sai.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  S3_PUBLIC_BASE_URL: string;

  @IsString()
  @IsOptional()
  S3_KEY_PREFIX: string;

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

  @IsOptional()
  @IsString()
  WEBRTC_STUN_URLS: string;

  // Chuỗi rỗng (chép nguyên webrtc.env.example) nghĩa là chưa dùng TURN.
  @ValidateIf((environment: EnvironmentVariables) => !!environment.WEBRTC_TURN_URLS)
  @IsString()
  @Matches(/^(turns?:\S+)(,\s*turns?:\S+)*$/, {
    message: 'WEBRTC_TURN_URLS must be a comma-separated list of turn:/turns: URLs',
  })
  WEBRTC_TURN_URLS: string;

  @ValidateIf((environment: EnvironmentVariables) => !!environment.WEBRTC_TURN_URLS)
  @IsString()
  @Matches(/\S/)
  WEBRTC_TURN_USERNAME: string;

  @ValidateIf((environment: EnvironmentVariables) => !!environment.WEBRTC_TURN_URLS)
  @IsString()
  @Matches(/\S/)
  WEBRTC_TURN_CREDENTIAL: string;
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
