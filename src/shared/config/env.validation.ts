import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string;

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
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  AI_SERVICE_BASE_URL: string;

  @IsString()
  AI_SERVICE_TOKEN: string;

  @IsIn(['http', 'stub'])
  @IsOptional()
  AI_PROVIDER: string;

  @IsIn(['local', 's3'])
  @IsOptional()
  STORAGE_PROVIDER: string;

  @IsIn(['manual', 'vnpay', 'sepay'])
  @IsOptional()
  PAYMENT_PROVIDER: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n${errors.toString()}`);
  }

  return validated;
}
