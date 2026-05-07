import type { AxiosError } from 'axios';
import axios, { type AxiosInstance, isAxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import type { AppEnv } from '@/config/env.js';
import type { AppLogger } from '@/lib/logger-types.js';
import type { SmsProvider } from './sms-provider.interface.js';
import type {
  SendArgs,
  SendResult,
  TextBeeSendRequest,
  TextBeeSendResponse,
} from './textbee.types.js';

export class TextBeeProvider implements SmsProvider {
  private readonly http: AxiosInstance;

  constructor(
    env: AppEnv,
    private readonly logger: AppLogger,
  ) {
    this.http = axios.create({
      baseURL: env.TEXTBEE_BASE_URL,
      timeout: env.TEXTBEE_TIMEOUT_MS,
      headers: { 'content-type': 'application/json' },
    });

    axiosRetry(this.http, {
      retries: env.TEXTBEE_MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) => {
        const status = err.response?.status;
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(err) ||
          (status !== undefined && status >= 500)
        );
      },
    });
  }

  async sendSMS(args: SendArgs): Promise<SendResult> {
    const url = `/devices/${encodeURIComponent(args.textbeeDeviceId)}/send-sms`;
    const body: TextBeeSendRequest = { recipients: args.recipients, message: args.message };
    const start = Date.now();
    try {
      const res = await this.http.post<TextBeeSendResponse>(url, body, {
        headers: { 'x-api-key': args.apiKey },
      });
      const messageId =
        (res.data?.data?.messageId as string | undefined) ??
        (res.data?.data?.smsBatchId as string | undefined);
      return {
        ok: true,
        providerMessageId: messageId,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorInfo = this.normaliseError(err);
      this.logger.warn(
        { device: args.textbeeDeviceId, ...errorInfo, latencyMs },
        'textbee send failed',
      );
      return {
        ok: false,
        errorCode: errorInfo.code,
        errorMessage: errorInfo.message,
        latencyMs,
      };
    }
  }

  async healthCheck(args: { textbeeDeviceId: string; apiKey: string }): Promise<boolean> {
    try {
      const status = await this.getDeviceStatus(args);
      return status.online;
    } catch {
      return false;
    }
  }

  async getDeviceStatus(args: {
    textbeeDeviceId: string;
    apiKey: string;
  }): Promise<{ online: boolean; batteryLevel?: number | null }> {
    const url = `/devices/${encodeURIComponent(args.textbeeDeviceId)}`;
    try {
      const res = await this.http.get<{ data?: Record<string, unknown> }>(url, {
        headers: { 'x-api-key': args.apiKey },
      });
      const data = res.data?.data ?? {};
      const enabled = (data['enabled'] as boolean | undefined) ?? true;
      const battery =
        (data['batteryLevel'] as number | undefined) ??
        (data['battery'] as number | undefined) ??
        null;
      return { online: enabled !== false, batteryLevel: battery };
    } catch {
      return { online: false, batteryLevel: null };
    }
  }

  private normaliseError(err: unknown): { code: string; message: string } {
    if (isAxiosError(err)) {
      const ax = err as AxiosError<{ message?: string; error?: string }>;
      const status = ax.response?.status;
      const data = ax.response?.data;
      const message = data?.message ?? data?.error ?? ax.message;
      const code = status ? `HTTP_${status}` : (ax.code ?? 'NETWORK_ERROR');
      return { code, message: typeof message === 'string' ? message : 'request failed' };
    }
    return { code: 'UNKNOWN', message: err instanceof Error ? err.message : 'unknown error' };
  }
}
