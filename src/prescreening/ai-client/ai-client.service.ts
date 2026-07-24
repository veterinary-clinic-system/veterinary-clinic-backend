import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { ChatRequest, ChatResponse, TriageRequest, TriageResponse } from './ai-client.types';

/**
 * Thin client for veterinary-clinic-ai (Section 3: "Internal REST over HTTP - NestJS
 * calls FastAPI endpoints directly"). The AI service isn't public - every call carries
 * the shared `AI_SERVICE_TOKEN` bearer token (Section 6).
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async triage(request: TriageRequest): Promise<TriageResponse> {
    return this.post<TriageResponse>('/api/v1/triage', request);
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.post<ChatResponse>('/api/v1/chat', request);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = this.configService.get<string>('aiService.baseUrl');
    const token = this.configService.get<string>('aiService.token');
    const timeout = this.configService.get<number>('aiService.timeoutMs');

    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(`${baseUrl}${path}`, body, {
          timeout,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(`veterinary-clinic-ai call to ${path} failed: ${axiosError.message}`);
      throw new ServiceUnavailableException('The AI pre-screening service is unavailable');
    }
  }
}
