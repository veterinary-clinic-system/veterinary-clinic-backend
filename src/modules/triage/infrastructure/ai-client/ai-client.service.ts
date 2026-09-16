import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { DiagnosisDetailedResponse, DiagnosisRequest } from './ai-client.types';

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async diagnose(request: DiagnosisRequest): Promise<DiagnosisDetailedResponse> {
    return this.post<DiagnosisDetailedResponse>('/api/v1/diagnose/detailed', request);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = this.configService.get<string>('aiService.baseUrl')!.replace(/\/$/, '');
    const token = this.configService.get<string>('aiService.token');
    const timeout = this.configService.get<number>('aiService.timeoutMs');

    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(`${baseUrl}${path}`, body, {
          timeout,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }),
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `veterinary-clinic-ai call to ${path} failed: ${axiosError.response?.status ?? 'network'} ${axiosError.message}`,
      );
      throw new ServiceUnavailableException('The AI pre-screening service is unavailable');
    }
  }
}
