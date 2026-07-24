import { registerAs } from '@nestjs/config';

export default registerAs('aiService', () => ({
  baseUrl: process.env.AI_SERVICE_BASE_URL ?? 'http://localhost:8000',
  token: process.env.AI_SERVICE_TOKEN,
  timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS ?? '15000', 10),
}));
