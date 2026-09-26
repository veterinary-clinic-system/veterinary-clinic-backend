import { registerAs } from '@nestjs/config';

export function resolveSwaggerEnabled(
  nodeEnv: string | undefined,
  configured: string | undefined,
): boolean {
  return configured === undefined ? nodeEnv !== 'production' : configured === 'true';
}

export default registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    swaggerEnabled: resolveSwaggerEnabled(nodeEnv, process.env.ENABLE_SWAGGER),
  };
});
