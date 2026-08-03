import { registerAs } from '@nestjs/config';

export default registerAs('aiService', () => ({
  /**
   * Chon adapter cho port AiPredictionProvider: 'http' (mac dinh, goi apps/veterinary-clinic-ai that)
   * hoac 'stub' (khong goi mang, ket qua tat dinh - dung cho test E2E va dien tap
   * kich ban AI chet). Xem modules/triage/application/ports/ai-prediction.port.ts.
   */
  provider: process.env.AI_PROVIDER ?? 'http',
  baseUrl: process.env.AI_SERVICE_BASE_URL ?? 'http://localhost:8000',
  token: process.env.AI_SERVICE_TOKEN,
  timeoutMs: parseInt(process.env.AI_SERVICE_TIMEOUT_MS ?? '15000', 10),
}));
